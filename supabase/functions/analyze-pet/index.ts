// Edge Function: analyze-pet
// Recibe { image_url } (URL firmada o pública) o { image_base64, mime }
// Llama a Lovable AI (Gemini) para reconocer raza, pelaje y 4 sugerencias de corte.
// Devuelve JSON estricto. LOVABLE_API_KEY vive solo en el servidor.
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
  image_url?: string;
  image_base64?: string;
  mime?: string;
}

interface Suggestion {
  title: string;
  description: string;
}
interface AnalyzeResult {
  breed: string;
  coat: "con_pelo" | "sin_pelo" | "desconocido";
  suggestions: Suggestion[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !LOVABLE_API_KEY) {
    return json({ error: "Configuración del servidor incompleta" }, 500);
  }

  // Validar sesión (JWT del llamante).
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

  let imageUrlForAi: string;
  if (payload.image_url) {
    imageUrlForAi = payload.image_url;
  } else if (payload.image_base64) {
    const mime = payload.mime ?? "image/jpeg";
    imageUrlForAi = `data:${mime};base64,${payload.image_base64}`;
  } else {
    return json({ error: "Falta la imagen" }, 400);
  }

  const systemPrompt =
    "Eres un peluquero canino experto. Analiza la foto de la mascota y devuelve SIEMPRE JSON estricto " +
    "con la forma: { \"breed\": string, \"coat\": \"con_pelo\"|\"sin_pelo\"|\"desconocido\", " +
    "\"suggestions\": [ {\"title\": string, \"description\": string} ] } con EXACTAMENTE 4 sugerencias " +
    "adaptadas a la raza y al pelaje. Títulos cortos (máx 4 palabras) y descripciones breves (1-2 frases) " +
    "en español, claras y sin tecnicismos. Si no puedes identificar la raza, usa \"Mestizo\". Nada de markdown.";

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta mascota y propón 4 cortes adecuados." },
            { type: "image_url", image_url: { url: imageUrlForAi } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResp.ok) {
    const text = await aiResp.text();
    if (aiResp.status === 429) return json({ error: "Demasiadas peticiones. Inténtalo en unos segundos." }, 429);
    if (aiResp.status === 402) return json({ error: "Sin créditos de IA disponibles." }, 402);
    console.error("analyze-pet AI error", aiResp.status, text);
    return json({ error: "La IA no pudo analizar la foto." }, 502);
  }

  const aiJson = await aiResp.json();
  const content: string = aiJson?.choices?.[0]?.message?.content ?? "";
  let parsed: AnalyzeResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("analyze-pet parse error", content);
    return json({ error: "Respuesta de IA no válida." }, 502);
  }

  // Normalizar / saneamiento mínimo.
  const coat: AnalyzeResult["coat"] =
    parsed.coat === "con_pelo" || parsed.coat === "sin_pelo" ? parsed.coat : "desconocido";
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [];
  while (suggestions.length < 4) {
    suggestions.push({ title: `Sugerencia ${suggestions.length + 1}`, description: "" });
  }
  const result: AnalyzeResult = {
    breed: (parsed.breed ?? "Mestizo").toString().slice(0, 80),
    coat,
    suggestions: suggestions.map((s) => ({
      title: (s?.title ?? "").toString().slice(0, 60) || "Sugerencia",
      description: (s?.description ?? "").toString().slice(0, 300),
    })),
  };

  return json(result);
});
