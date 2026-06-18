// Edge Function: generate-cut-image
// Recibe { pet_id, title, description, breed, coat }
// Genera UNA imagen de referencia del corte con Lovable AI (image gen),
// la sube a Storage (bucket pet-photos, carpeta cuts/<pet_id>/...) y devuelve { image_url }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Payload {
  pet_id: string;
  title: string;
  description?: string;
  breed?: string;
  coat?: "con_pelo" | "sin_pelo" | "desconocido";
  image_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !LOVABLE_API_KEY) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Sesión inválida" }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!payload.pet_id || !payload.title) return json({ error: "Faltan datos" }, 400);

  const descPart = payload.description ? ` ${payload.description}` : "";
  const editPrompt =
    `Edita esta fotografia REAL de un perro para mostrar como quedaria tras pasar por la peluqueria canina, ` +
    `manteniendo la MAXIMA fidelidad con la foto original. Conserva EXACTAMENTE, sin alterarlos: el mismo perro y su identidad, ` +
    `los rasgos y la expresion facial, la pose y la posicion del cuerpo, el angulo y el encuadre de la camara, el fondo, ` +
    `la iluminacion, y la complexion y el peso del animal. Lo UNICO que debe cambiar es el pelaje y el corte, que debe quedar asi: ` +
    `"${payload.title}",${descPart}. El resultado debe ser fotorrealista, con textura de pelo natural y coherente, ` +
    `como una foto real del mismo perro recien salido de la peluqueria. Sin texto, sin marcas de agua y sin elementos anadidos.`;

  const coatText =
    payload.coat === "con_pelo"
      ? "perro con pelo"
      : payload.coat === "sin_pelo"
        ? "perro sin pelo"
        : "perro";
  const breedText = payload.breed ? `, raza ${payload.breed}` : "";
  const fallbackPrompt =
    `Fotografía de referencia, fondo neutro y limpio, iluminación de estudio suave, de un ${coatText}${breedText} ` +
    `recién salido de peluquería canina con el corte llamado "${payload.title}". ` +
    `${payload.description ?? ""}. Plano entero, encuadre centrado, estilo catálogo de peluquería, sin texto, sin marcas.`;

  const userContent: unknown = payload.image_url
    ? [
        { type: "text", text: editPrompt },
        { type: "image_url", image_url: { url: payload.image_url } },
      ]
    : fallbackPrompt;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: userContent }],
      modalities: ["image", "text"],
    }),
  });

  if (!aiResp.ok) {
    const text = await aiResp.text();
    if (aiResp.status === 429) return json({ error: "Demasiadas peticiones." }, 429);
    if (aiResp.status === 402) return json({ error: "Sin créditos de IA disponibles." }, 402);
    console.error("generate-cut-image AI error", aiResp.status, text);
    return json({ error: "La IA no pudo generar la imagen." }, 502);
  }

  const aiJson = await aiResp.json();
  // El modelo devuelve la imagen como data URL en message.images[0].image_url.url
  const dataUrl: string | undefined =
    aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    console.error("generate-cut-image no image in response", JSON.stringify(aiJson).slice(0, 500));
    return json({ error: "La IA no devolvió imagen." }, 502);
  }

  // data:image/png;base64,xxxx
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return json({ error: "Imagen con formato inesperado." }, 502);
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const path = `cuts/${payload.pet_id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from("pet-photos").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) {
    console.error("generate-cut-image upload error", upErr);
    return json({ error: "No se pudo guardar la imagen." }, 500);
  }

  // URL firmada (1 año) para mostrar en la UI.
  const { data: signed, error: signErr } = await admin.storage
    .from("pet-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed?.signedUrl) {
    return json({ error: "No se pudo firmar la imagen." }, 500);
  }

  return json({ image_url: signed.signedUrl, path });
});
