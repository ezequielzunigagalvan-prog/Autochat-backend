import OpenAI from "openai";

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function buildBusinessContext(business) {
  const services = business.services
    .map((service) => `- ${service.name}: ${service.durationMinutes} min, $${service.price}`)
    .join("\n");
  const faqs = business.faqs
    .map((faq) => `- ${faq.question}: ${faq.answer}`)
    .join("\n");

  return [
    `Negocio: ${business.name}`,
    `Tipo: ${business.niche}`,
    `Teléfono: ${business.phone || "no configurado"}`,
    `Dirección: ${business.address || "no configurada"}`,
    `Horario: ${business.hours || "no configurado"}`,
    `Tono: ${business.tone || "amable y profesional"}`,
    "Servicios:",
    services || "- No hay servicios configurados",
    "Preguntas frecuentes:",
    faqs || "- No hay FAQs configuradas"
  ].join("\n");
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateBusinessReply({
  business,
  customer,
  recentConversations = [],
  customerText,
  intent,
  fallbackReply
}) {
  const client = getClient();
  if (!client) return null;

  const history = recentConversations
    .map((item) => `Cliente: ${item.inboundText}\nAsistente: ${item.outboundText}`)
    .join("\n\n");

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    reasoning: { effort: "minimal" },
    max_output_tokens: 220,
    instructions: [
      "Eres un asistente de atención al cliente para negocios locales.",
      "Responde siempre en español natural, breve y útil.",
      "Usa solo la información del contexto del negocio. No inventes precios, servicios, horarios, ubicaciones ni disponibilidad.",
      "Si falta información, dilo con claridad y ofrece pasar con una persona del equipo.",
      "Si el cliente quiere agendar, pide servicio, día y hora preferida. No confirmes una cita como reservada hasta que el sistema la cree.",
      "No menciones que eres IA ni detalles técnicos internos."
    ].join("\n"),
    input: [
      {
        role: "developer",
        content: [
          `Contexto del negocio:\n${buildBusinessContext(business)}`,
          `Estado actual del cliente: ${customer?.conversationState || "idle"}`,
          `Servicio pendiente: ${customer?.pendingServiceId || "ninguno"}`,
          `Fecha pendiente: ${customer?.pendingStartsAt?.toISOString?.() || "ninguna"}`,
          `Historial reciente:\n${history || "sin historial"}`,
          `Intención detectada: ${intent}`,
          `Respuesta base si hace falta: ${fallbackReply}`
        ].join("\n\n")
      },
      {
        role: "user",
        content: customerText
      }
    ]
  });

  return response.output_text?.trim() || null;
}
