import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { homeTeam, awayTeam, offeredOdds, betType, legs, notes } = await req.json();

    // Prefer env var, fallback to provided key for convenience
    const GEMINI_API_KEY =
      Deno.env.get("GEMINI_API_KEY") ?? "AIzaSyBMpHfzm2ohVhza7DUvIBw2GNO2t0KVQj4";
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const legsDescription = Array.isArray(legs)
      ? legs
          .map(
            (leg: Record<string, string>, idx: number) =>
              `${idx + 1}. Mercado: ${leg.market ?? ""} | Seleccion: ${leg.selection ?? ""} | Cuota: ${leg.odds ?? ""}`
          )
          .join("\n")
      : "No se proporcionaron selecciones.";

    const systemPrompt = `Eres un analista experto en apuestas deportivas. Evalua si la apuesta tiene valor esperado (EV), calcula una cuota justa aproximada y propone un plan accionable. Devuelve SIEMPRE un JSON estricto con el siguiente formato:

{
  "recommendedStake": "Numero entre 0-10 representando el % de bankroll recomendado",
  "isEvPositive": true,
  "fairOdds": "Cuota decimal estimada como justa. Ej: 1.92",
  "valueVerdict": "Frase corta indicando EV+, neutral o EV- y por que",
  "executiveSummary": "Resumen conciso de 2-3 lineas con conclusiones clave",
  "evOpportunities": [
    "Oportunidad o ajuste de valor 1",
    "Oportunidad o ajuste de valor 2",
    "Oportunidad o ajuste de valor 3"
  ],
  "advancedSignals": [
    "Senal avanzada o bandera (lesiones, mercado, ritmo, clima, etc.)",
    "Otra senal",
    "Otra senal"
  ],
  "actionPlan": [
    "Paso de accion 1",
    "Paso de accion 2",
    "Paso de accion 3",
    "Paso de accion 4"
  ]
}`;

    const userPrompt = `Analiza esta apuesta:
Partido: ${homeTeam} vs ${awayTeam}
Tipo: ${betType}
Cuota ofrecida: ${offeredOdds}
Selecciones:
${legsDescription}
Notas adicionales del usuario: ${notes ?? "N/A"}

Indica si es EV+ o no, estima la cuota justa y el stake recomendado.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            role: "system",
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de peticiones excedido. Intentalo de nuevo mas tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Error en el analisis de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No se recibio respuesta del modelo de IA");
    }

    const analysis = JSON.parse(content);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-pick function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
