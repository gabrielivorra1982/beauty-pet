// Edge Function: analyze-pet
// Recibe { image_url } (URL firmada o pública) o { image_base64, mime }
// Llama a Lovable AI (Gemini) para reconocer raza, pelaje y sugerencias.
// El prompt se construye a partir de una BASE DE CONOCIMIENTO mantenible.
// LOVABLE_API_KEY vive solo en el servidor.
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

type Advice = "cortable" | "no_rapar_doble_capa" | "sin_pelo";
type Coat = "con_pelo" | "sin_pelo" | "desconocido";

interface Suggestion {
  title: string;
  description: string;
}
interface AnalyzeResult {
  breed: string;
  coat: Coat;
  groomable: boolean;
  advice: Advice;
  warning: string | null;
  suggestions: Suggestion[];
}

// =============================================================
// BASE DE CONOCIMIENTO DE PELUQUERÍA CANINA (mantenible)
// =============================================================
const GROOMING_KB = {
  estilos: [
    { nombre: "Corte cachorro", descripcion: "largo uniforme corto por todo el cuerpo" },
    { nombre: "Oso de peluche", descripcion: "cara y patas redondeadas, aspecto peluche" },
    { nombre: "Cordero", descripcion: "cuerpo corto, patas más largas redondeadas" },
    { nombre: "Schnauzer", descripcion: "cuerpo corto, cejas y barba largas" },
    { nombre: "De perrera/verano", descripcion: "muy corto, práctico" },
    { nombre: "Top knot/moño", descripcion: "recogido del pelo de la cabeza" },
    {
      nombre: "León, mohawk y pompones",
      descripcion: "llamativos, solo en razas adecuadas y NUNCA en doble capa",
    },
  ],
  sin_pelo: {
    razas: [
      "Xoloitzcuintle",
      "Crestado Chino (variedad sin pelo)",
      "American Hairless Terrier",
      "Perro sin pelo del Perú",
    ],
    mensaje:
      "No procede corte. Estas razas necesitan cuidados de piel: hidratación, protección solar y limpieza regular.",
  },
  doble_capa: {
    razas: [
      "Golden Retriever",
      "Labrador",
      "Husky Siberiano",
      "Malamute",
      "Pastor Alemán",
      "Pastor Australiano",
      "Border Collie",
      "Boyero de Berna",
      "Chow Chow",
      "Akita",
      "Shiba Inu",
      "Keeshond",
      "Samoyedo",
      "Pomerania",
      "Gran Pirineo",
      "Terranova",
      "Corgi",
      "San Bernardo",
      "Spitz",
    ],
    mensaje:
      "No rapar ni dejar el cuerpo muy corto: daña el manto y la termorregulación. Se recomienda deslanado y arreglo.",
    servicios_recomendados: [
      "Deslanado y cepillado profundo",
      "Baño y secado técnico",
      "Recorte de líneas y contorno",
      "Arreglo de patas y zona sanitaria",
      "Recorte de orejas y cola",
    ],
  },
  pelo_duro: {
    razas: [
      "Schnauzer",
      "Fox Terrier",
      "Cairn Terrier",
      "Border Terrier",
      "West Highland White Terrier (Westie)",
      "Airedale Terrier",
    ],
    nota:
      "Idealmente stripping (arranque manual) para conservar color y textura del manto; con máquina el pelo se ablanda.",
  },
  cortable: {
    razas: [
      "Caniche/Poodle",
      "Bichón Frisé",
      "Shih Tzu",
      "Maltés",
      "Yorkshire Terrier",
      "Lhasa Apso",
      "Cocker Spaniel",
      "Perro de Agua",
      "Doodles (Goldendoodle, Labradoodle…)",
      "Habanero",
      "Coton de Tuléar",
    ],
  },
};

function buildSystemPrompt(): string {
  const kb = GROOMING_KB;
  const estilos = kb.estilos.map((e) => `- ${e.nombre}: ${e.descripcion}`).join("\n");
  const sinPelo = kb.sin_pelo.razas.join(", ");
  const dobleCapa = kb.doble_capa.razas.join(", ");
  const dobleCapaServ = kb.doble_capa.servicios_recomendados.map((s) => `- ${s}`).join("\n");
  const peloDuro = kb.pelo_duro.razas.join(", ");
  const cortable = kb.cortable.razas.join(", ");

  return [
    "Eres un peluquero canino experto. Analiza la foto de la mascota y responde SIEMPRE en JSON estricto, sin markdown.",
    "",
    "BASE DE CONOCIMIENTO — ESTILOS DE CORTE (usa estos nombres):",
    estilos,
    "",
    `REGLA 1 (SIN PELAJE): Si la raza es sin pelo (${sinPelo}) o visualmente no hay pelo, devuelve groomable=false, advice="sin_pelo", suggestions=[] (vacío) y un warning explicando que no procede corte y que el cuidado es de piel (hidratación, protección solar, limpieza).`,
    "",
    `REGLA 2 (DOBLE CAPA): NUNCA rapar ni dejar el cuerpo muy corto en razas de doble capa (${dobleCapa} y similares). Devuelve groomable=true, advice="no_rapar_doble_capa", warning explicando que rapar daña el manto y la termorregulación. Las 4 sugerencias deben ser SIEMPRE de deslanado/arreglo (NO rapado, NO corte león, NO cuerpo muy corto):`,
    dobleCapaServ,
    "",
    `REGLA 3 (PELO DURO): Schnauzer y terriers de pelo duro (${peloDuro}): advice="cortable", warning con nota breve: "${kb.pelo_duro.nota}". Las 4 sugerencias se adaptan a la raza.`,
    "",
    `REGLA 4 (CORTABLE NORMAL): Razas de pelo que crece y se corta (${cortable}, etc.): advice="cortable", warning=null, 4 sugerencias del catálogo apropiadas a raza y pelaje.`,
    "",
    'FORMATO JSON ESTRICTO: { "breed": string, "coat": "con_pelo"|"sin_pelo"|"desconocido", "groomable": boolean, "advice": "cortable"|"no_rapar_doble_capa"|"sin_pelo", "warning": string|null, "suggestions": [ {"title": string, "description": string} ] }',
    "- Títulos cortos (máx 4 palabras) y descripciones breves (1-2 frases) en español, sin tecnicismos.",
    "- Si advice = \"sin_pelo\": suggestions = [] (lista vacía).",
    "- En cualquier otro caso: EXACTAMENTE 4 sugerencias.",
    '- Si no puedes identificar la raza, usa "Mestizo".',
  ].join("\n");
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

  const systemPrompt = buildSystemPrompt();

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
            {
              type: "text",
              text:
                "Analiza esta mascota. Identifica raza y pelaje, aplica las reglas de la base de conocimiento y devuelve el JSON con groomable, advice, warning y sugerencias según corresponda.",
            },
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
  let parsed: Partial<AnalyzeResult>;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("analyze-pet parse error", content);
    return json({ error: "Respuesta de IA no válida." }, 502);
  }

  // --- Saneamiento ---
  const coat: Coat =
    parsed.coat === "con_pelo" || parsed.coat === "sin_pelo" ? parsed.coat : "desconocido";

  const adviceRaw = parsed.advice;
  let advice: Advice =
    adviceRaw === "sin_pelo" || adviceRaw === "no_rapar_doble_capa" || adviceRaw === "cortable"
      ? adviceRaw
      : "cortable";

  // Coherencia: si coat es sin_pelo, fuerza advice=sin_pelo.
  if (coat === "sin_pelo") advice = "sin_pelo";

  const groomable = advice === "sin_pelo" ? false : Boolean(parsed.groomable ?? true);

  const warningRaw = parsed.warning;
  const warning: string | null =
    typeof warningRaw === "string" && warningRaw.trim().length > 0
      ? warningRaw.toString().slice(0, 400)
      : null;

  let suggestions: Suggestion[] = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.slice(0, 4).map((s) => ({
        title: (s?.title ?? "").toString().slice(0, 60) || "Sugerencia",
        description: (s?.description ?? "").toString().slice(0, 300),
      }))
    : [];

  if (advice === "sin_pelo") {
    suggestions = [];
  } else {
    while (suggestions.length < 4) {
      suggestions.push({ title: `Sugerencia ${suggestions.length + 1}`, description: "" });
    }
  }

  const result: AnalyzeResult = {
    breed: (parsed.breed ?? "Mestizo").toString().slice(0, 80),
    coat,
    groomable,
    advice,
    warning,
    suggestions,
  };

  return json(result);
});
