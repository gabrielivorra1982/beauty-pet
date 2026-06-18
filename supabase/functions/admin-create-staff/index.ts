// Edge Function: admin-create-staff
// Crea una nueva cuenta de equipo (operador o admin). Solo invocable por un usuario
// autenticado cuyo profiles.role = 'admin'. La service role NUNCA llega al cliente:
// se usa exclusivamente dentro de esta función para crear el usuario en auth.users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateStaffPayload {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "operador";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
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

  // 1) Identidad: verificar JWT pidiéndole al Auth server el usuario asociado.
  //    No confiamos en ningún user_id enviado por el cliente.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Sesión inválida" }, 401);
  }
  const callerId = userData.user.id;

  // 2) Autorización: comprobar profiles.role = 'admin' en el servidor.
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
    return json({ error: "Solo un administrador puede crear cuentas" }, 403);
  }

  // 3) Validar payload.
  let payload: CreateStaffPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const email = (payload.email ?? "").trim().toLowerCase();
  const password = payload.password ?? "";
  const full_name = (payload.full_name ?? "").trim();
  const role = payload.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Email no válido" }, 400);
  }
  if (!password || password.length < 8) {
    return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  }
  if (!full_name) return json({ error: "Falta el nombre" }, 400);
  if (role !== "admin" && role !== "operador") {
    return json({ error: "Rol no válido" }, 400);
  }

  // 4) Crear usuario con service role. El trigger handle_new_user creará el profile.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? "No se pudo crear el usuario" }, 400);
  }

  // 5) Asegurar que el rol final del profile es el solicitado (el default es 'operador').
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ full_name, role })
    .eq("id", created.user.id);
  if (updateErr) {
    return json({ error: "Usuario creado pero no se pudo asignar el rol", detail: updateErr.message }, 500);
  }

  return json({ ok: true, user_id: created.user.id, email, role, full_name }, 201);
});
