// Edge Function: gdpr-delete-owner
// Borrado RGPD de un dueño: limpia las fotos del bucket pet-photos para todas
// sus mascotas (originals/<petId>/ y cuts/<petId>/) y luego borra la fila del
// dueño. Las FK en CASCADE arrastran pets, visits, cut_suggestions y pet_rewards.
// Solo invocable por un usuario autenticado con profiles.role = 'admin'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "pet-photos";
const PAGE = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deletePrefix(
  admin: ReturnType<typeof createClient>,
  prefix: string,
): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;
  // Paginar: list devuelve hasta `limit`; repetir desde offset=0 tras cada remove
  // porque los borrados desplazan el listado.
  // Bucle defensivo con tope para evitar loops infinitos.
  for (let i = 0; i < 100; i++) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset: 0 });
    if (error) {
      console.error(`list ${prefix} falló`, error.message);
      errors++;
      break;
    }
    if (!data || data.length === 0) break;
    const paths = data
      .filter((o) => o.name && !o.name.endsWith("/"))
      .map((o) => `${prefix}${o.name}`);
    if (paths.length === 0) break;
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
    if (rmErr) {
      console.error(`remove ${prefix} falló`, rmErr.message);
      errors++;
      break;
    }
    deleted += paths.length;
    if (data.length < PAGE) break;
  }
  return { deleted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Falta token de autenticación" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return json({ error: "Token vacío" }, 401);

  // 1) Identidad
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Sesión inválida" }, 401);
  const callerId = userData.user.id;

  // 2) Autorización admin
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (profileErr) return json({ error: "No se pudo verificar el rol" }, 500);
  if (!profile || profile.role !== "admin") {
    return json({ error: "Solo un administrador puede borrar dueños (RGPD)" }, 403);
  }

  // 3) Payload
  let payload: { owner_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const owner_id = (payload.owner_id ?? "").trim();
  if (!owner_id) return json({ error: "Falta owner_id" }, 400);

  // 4) Obtener mascotas del dueño
  const { data: pets, error: petsErr } = await admin
    .from("pets")
    .select("id")
    .eq("owner_id", owner_id);
  if (petsErr) return json({ error: "No se pudieron listar las mascotas" }, 500);

  const petIds = (pets ?? []).map((p: { id: string }) => p.id);

  // 5) Best-effort: limpiar fotos por mascota
  let fotos_eliminadas = 0;
  for (const petId of petIds) {
    const a = await deletePrefix(admin, `originals/${petId}/`);
    const b = await deletePrefix(admin, `cuts/${petId}/`);
    fotos_eliminadas += a.deleted + b.deleted;
  }

  // 6) Borrar el dueño (CASCADE arrastra el resto)
  const { error: delErr } = await admin.from("owners").delete().eq("id", owner_id);
  if (delErr) {
    return json(
      { error: "No se pudo borrar el dueño", detail: delErr.message, fotos_eliminadas },
      500,
    );
  }

  return json({ ok: true, pets_eliminadas: petIds.length, fotos_eliminadas });
});
