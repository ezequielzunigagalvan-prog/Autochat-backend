import { prisma } from "../../prisma.js";
import { generateBusinessReply } from "../ai/openaiService.js";
import { addMinutes, availabilityMessage, checkAppointmentAvailability } from "../appointments/availability.js";
import { ensureDemoBusiness, isDemoBusinessId } from "../demoBusinesses.js";
import { notifyBusinessLead } from "../notifications/notification.service.js";

const scheduleKeywords = [
  "cita",
  "agendar",
  "programar",
  "reservar",
  "apartar",
  "agenda",
  "turno",
  "disponibilidad",
  "horario disponible"
];
const cancelAppointmentKeywords = ["cancelar cita", "cancela mi cita", "cancelar mi cita", "anular cita"];
const rescheduleKeywords = ["reagendar", "reprogramar", "cambiar cita", "mover cita", "cambiar mi cita"];
const humanKeywords = ["humano", "asesor", "persona", "llamar", "queja", "atencion", "atención", "soporte", "contacto"];
const cancelKeywords = ["cancelar", "reiniciar", "empezar de nuevo", "salir", "reset"];
const PROJECTS_DEMO_ID = "demo_proyectos";
const APPOINTMENT_DEMO_IDS = ["demo_barberia", "demo_dental"];
const LUBRIPLAN_BUSINESS_ID = "cmoyi5hsk0005nd4f32980jsq";
const QUOTE_BASED_NICHES = ["industrial", "servicios", "proyectos", "inmobiliaria", "educacion"];
const quoteKeywords = ["cotizar", "cotizacion", "cotización", "precio", "presupuesto", "propuesta", "servicio", "informacion", "información"];
const strongQuoteKeywords = ["cotizar", "cotizacion", "cotización", "precio", "presupuesto", "propuesta"];
const servicesKeywords = ["servicio", "servicios", "opciones", "catalogo", "catálogo", "que hacen", "qué hacen"];
const greetingKeywords = ["hola", "buenas", "buen dia", "buen día", "buenos dias", "buenos días", "info", "informes", "ayuda"];
const yesKeywords = ["si", "sí", "claro", "ok", "cotizar", "cotizacion", "cotización", "solicitar", "adelante", "me interesa"];
const noKeywords = ["no", "despues", "después", "otro", "ver otro", "regresar", "servicios"];

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function includesAny(text, keywords) {
  const normalized = normalize(text);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function isQuoteBasedBusiness(business) {
  if (business.automationType) {
    return business.automationType === "quote" || business.automationType === "hybrid";
  }

  return QUOTE_BASED_NICHES.includes(business.niche);
}

function isLubriPlanBusiness(business) {
  return business?.id === LUBRIPLAN_BUSINESS_ID || normalize(business?.name).includes("lubriplan");
}

function isGreetingOrShortHelp(text) {
  const normalized = normalize(text);
  return (
    greetingKeywords.some((keyword) => normalized === normalize(keyword) || normalized.includes(normalize(keyword))) ||
    normalized.length <= 3
  );
}

function mainMenuReply(business) {
  if (isLubriPlanBusiness(business)) {
    return [
      "Hola, soy el asistente de LubriPlan. ¿En qué puedo ayudarte?",
      "",
      "1. ¿Qué es LubriPlan?",
      "2. Cómo funciona",
      "3. Promoción actual",
      "4. Implementarlo en mi planta",
      "",
      "Responde con el número de la opción o dime qué necesitas."
    ].join("\n");
  }

  return [
    `Hola, soy el asistente de ${business.name}. ¿En qué puedo ayudarte hoy?`,
    "",
    "1. Ver servicios",
    isQuoteBasedBusiness(business) ? "2. Solicitar cotización" : "2. Agendar cita",
    "3. Atención con una persona",
    "",
    "Responde con el número de la opción o dime qué necesitas."
  ].join("\n");
}

function detectMainMenuChoice(text, business) {
  const normalized = normalize(text);
  if (isLubriPlanBusiness(business)) {
    if (/^(1|uno|opcion 1|opcion uno)\b/.test(normalized) || normalized.includes("que es") || normalized.includes("informacion")) return "lubriplan_info";
    if (/^(2|dos|opcion 2|opcion dos)\b/.test(normalized) || normalized.includes("como funciona")) return "lubriplan_how";
    if (/^(3|tres|opcion 3|opcion tres)\b/.test(normalized) || normalized.includes("promocion") || normalized.includes("gratis")) return "lubriplan_promo";
    if (/^(4|cuatro|opcion 4|opcion cuatro)\b/.test(normalized) || normalized.includes("implementar") || normalized.includes("implementacion") || normalized.includes("planta")) return "lubriplan_implementation";
  }

  const quoteBased = isQuoteBasedBusiness(business);

  if (/^(1|uno|opcion 1|opcion uno)\b/.test(normalized) || includesAny(text, servicesKeywords)) return "services";
  if (/^(2|dos|opcion 2|opcion dos)\b/.test(normalized)) return quoteBased ? "quote" : "schedule";
  if (/^(3|tres|opcion 3|opcion tres)\b/.test(normalized) || includesAny(text, humanKeywords)) return "human";
  if (quoteBased && includesAny(text, quoteKeywords)) return "quote";
  if (!quoteBased && includesAny(text, scheduleKeywords)) return "schedule";
  return null;
}

function servicesReply(business) {
  const nextStep = isQuoteBasedBusiness(business)
    ? "Responde con el número o escribe el nombre del servicio que quieres cotizar."
    : "Responde con el número o escribe el nombre del servicio que quieres agendar.";

  return [
    "Estos son los servicios disponibles:",
    formatServices(business.services, business),
    "",
    nextStep
  ].join("\n");
}

function serviceOptionsContext(business) {
  return {
    flow: "services_list",
    options: business.services.map((service) => ({
      id: service.id,
      name: service.name
    }))
  };
}

function serviceConnectorReply(service) {
  return [
    "Perfecto. Has seleccionado:",
    "",
    service.name,
    service.description ? `\n${service.description}` : "",
    "",
    service.connectorQuestion || "¿Quieres que prepare una solicitud de cotización para este servicio?",
    "",
    `1. ${service.connectorCta || "Solicitar cotización"}`,
    "2. Ver otro servicio"
  ].filter(Boolean).join("\n");
}

function wantsConnectorQuote(text) {
  const normalized = normalize(text);
  return /^(1|uno|opcion 1|opcion uno)\b/.test(normalized) || yesKeywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function wantsAnotherService(text) {
  const normalized = normalize(text);
  return /^(2|dos|opcion 2|opcion dos)\b/.test(normalized) || noKeywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function findServiceFromContext({ business, customer, text }) {
  const pending = parsePendingData(customer);
  const options = Array.isArray(pending.options) ? pending.options : [];
  const normalized = normalize(text);
  const number = Number.parseInt(normalized, 10);

  if (Number.isInteger(number) && number > 0) {
    const option = options[number - 1];
    if (option) {
      return business.services.find((service) => service.id === option.id || service.name === option.name);
    }
  }

  const option = options.find((item) => {
    const optionName = normalize(item.name);
    return optionName.includes(normalized) || normalized.includes(optionName);
  });
  if (option) {
    return business.services.find((service) => service.id === option.id || service.name === option.name);
  }

  return findServiceFromText(business.services, text);
}

async function startServiceSelection(customer, business) {
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: "select_service",
      pendingData: JSON.stringify(serviceOptionsContext(business)),
      lastIntent: "services"
    }
  });

  return {
    intent: "select_service",
    status: "auto_replied",
    reply: servicesReply(business)
  };
}

async function handleServiceSelection({ business, customer, service }) {
  if (isQuoteBasedBusiness(business)) {
    const data = { service: service.name, serviceId: service.id };

    if (service.connectorEnabled !== false) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          conversationState: "service_connector",
          pendingData: JSON.stringify(data),
          lastIntent: "service_connector"
        }
      });

      return {
        intent: "service_connector",
        status: "auto_replied",
        reply: serviceConnectorReply(service)
      };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "quote_details",
        pendingData: JSON.stringify(data),
        lastIntent: "quote_service_selected"
      }
    });

    return {
      intent: "quote_details",
      status: "auto_replied",
      reply: [
        "Perfecto. Has seleccionado:",
        "",
        service.name,
        "",
        quoteDetailQuestion(business, "quote_details")
      ].join("\n")
    };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: "scheduling_datetime",
      pendingServiceId: service.id,
      pendingData: "{}",
      lastIntent: "scheduling_service_selected"
    }
  });

  return {
    intent: "scheduling_datetime",
    status: "scheduling",
    reply: `Perfecto, ${service.name}. ¿Qué día y hora te conviene? Por ejemplo: mañana a las 4 pm o 27/04 16:00.`
  };
}

function quoteIntroReply(business) {
  const serviceList = business.services.length
    ? `\n\nServicios:\n${formatServices(business.services, business)}`
    : "";
  return [
    "Perfecto, te ayudo a levantar una solicitud de cotización.",
    "Primero dime qué servicio necesitas o cuál es el problema que quieres resolver.",
    serviceList
  ].join("\n");
}

function quoteDetailQuestion(business, step) {
  if (business.niche === "industrial") {
    const industrialQuestions = {
      quote_details:
        "Gracias. Ahora cuéntame un poco más: tipo de equipo o sistema, fluido/material, capacidad aproximada y qué falla o necesidad tienen.",
      quote_location: "¿En qué ciudad o planta se realizaría el servicio?",
      quote_urgency: "¿Qué tan urgente es? Puedes responder: urgente, esta semana, este mes o programado."
    };
    return industrialQuestions[step];
  }

  const generalQuestions = {
    quote_details: "Gracias. Ahora cuéntame los detalles principales del proyecto o servicio que necesitas.",
    quote_location: "¿En qué ciudad o zona se realizaría?",
    quote_urgency: "¿Cuándo lo necesitas: urgente, esta semana, este mes o programado?"
  };
  return generalQuestions[step];
}

function quoteSummary(data) {
  const title = normalize(data.service).includes("implementacion")
    ? "Solicitud de implementación"
    : "Solicitud de cotización";
  return [
    title,
    `Servicio: ${data.service || "No especificado"}`,
    `Detalles: ${data.details || "No especificados"}`,
    `Ubicación: ${data.location || "No especificada"}`,
    `Urgencia: ${data.urgency || "No especificada"}`
  ].join("\n");
}

function parseContactFields(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : ["name", "phone"];
  } catch {
    return ["name", "phone"];
  }
}

function contactFieldsForCustomer(customer, business) {
  let service = null;
  const quoteDefaultFields = ["name", "phone", "email", "company", "city", "equipment", "urgency"];

  if (isLubriPlanBusiness(business)) {
    return {
      serviceName: "Implementación en planta",
      contactFields: ["name", "phone", "email", "company"]
    };
  }

  if (customer?.pendingServiceId) {
    service = business.services.find((item) => item.id === customer.pendingServiceId);
  }

  if (!service && customer?.quoteService) {
    service = business.services.find((item) => normalize(item.name) === normalize(customer.quoteService));
  }

  if (!service && customer?.pendingData) {
    try {
      const pendingData = JSON.parse(customer.pendingData);
      if (pendingData?.service) {
        service = business.services.find((item) => normalize(item.name) === normalize(pendingData.service));
      }
    } catch {
      service = null;
    }
  }

  if (!service) {
    return {
      serviceName: "",
      contactFields: isQuoteBasedBusiness(business) ? quoteDefaultFields : ["name", "phone", "email"]
    };
  }

  if (APPOINTMENT_DEMO_IDS.includes(business.id)) {
    return {
      serviceName: service.name,
      contactFields: ["phone"]
    };
  }

  const serviceFields = parseContactFields(service.contactFields);

  return {
    serviceName: service.name,
    contactFields: isQuoteBasedBusiness(business) && serviceFields.length <= 2
      ? quoteDefaultFields
      : serviceFields
  };
}

async function startMainMenu(customer, business) {
  await prisma.customer.update({
    where: { id: customer.id },
    data: { conversationState: "main_menu", pendingData: "{}" }
  });
  return {
    intent: "main_menu",
    status: "auto_replied",
    reply: mainMenuReply(business)
  };
}

async function startQuoteFlow(customer, business, seedText = "") {
  const data = {};
  const service = findServiceFromText(business.services, seedText);
  if (service) data.service = service.name;

  const conversationState = data.service ? "quote_details" : "quote_service";
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState,
      pendingData: JSON.stringify(data),
      lastIntent: "quote_request"
    }
  });

  return {
    intent: conversationState,
    status: "auto_replied",
    reply: data.service ? quoteDetailQuestion(business, "quote_details") : quoteIntroReply(business)
  };
}

async function completeQuoteFlow(customer, data, business) {
  const summary = quoteSummary(data);
  const updatedCustomer = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: "idle",
      pendingData: "{}",
      leadStatus: "contactado",
      needsHuman: true,
      notes: [customer.notes, summary].filter(Boolean).join("\n\n"),
      quoteService: data.service || "",
      quoteDetails: data.details || "",
      quoteLocation: data.location || "",
      quoteUrgency: data.urgency || "",
      lastIntent: "quote_complete"
    }
  });

  notifyBusinessLead({
    business,
    customer: updatedCustomer,
    type: "quote_complete"
  }).catch((error) => {
    console.error("[notifications] quote notification failed:", error);
  });

  return {
    intent: "quote_complete",
    status: "needs_human",
    reply: [
      "Listo, dejé registrada tu solicitud para revisarla con el equipo.",
      "",
      summary,
      "",
      "Como depende de condiciones técnicas, no te doy un precio automático. Una persona del equipo revisará la información y te contactará para afinar la cotización."
    ].join("\n")
  };
}

function notifyNeedsHuman(business, customer) {
  notifyBusinessLead({
    business,
    customer,
    type: "needs_human"
  }).catch((error) => {
    console.error("[notifications] human notification failed:", error);
  });
}

function hasProjectDiagnosticInfo(text) {
  const normalized = normalize(text);
  const signals = [
    "negocio",
    "servicio",
    "horario",
    "cliente",
    "cita",
    "cotizacion",
    "venta",
    "precio",
    "whatsapp",
    "instagram",
    "pagina",
    "consultorio",
    "barberia",
    "estetica",
    "taller",
    "clinica",
    "inmobiliaria"
  ];
  return signals.filter((signal) => normalized.includes(signal)).length >= 2 || text.length > 80;
}

function projectDiagnosticRequest() {
  return [
    "Para armarte un ejemplo aterrizado, cuéntame esto de tu negocio:",
    "",
    "1. ¿Qué vendes o qué servicio das?",
    "2. ¿Qué datos necesitas pedirle al cliente?",
    "3. ¿Qué preguntas te hacen seguido?",
    "4. ¿Quieres recibir citas, cotizaciones o solo leads?",
    "",
    "Ejemplo: tengo una estética, atiendo lunes a sábado, hago uñas y faciales, quiero capturar nombre, WhatsApp, servicio y horario."
  ].join("\n");
}

function projectDiagnosticExample(text) {
  const summary = text.slice(0, 180);
  return [
    "Perfecto. Con esa información, tu asistente podría funcionar así:",
    "",
    "Resumen detectado:",
    summary,
    "",
    "Ejemplo de conversación:",
    "Cliente: Hola, quiero información.",
    "Bot: Claro. ¿Qué servicio te interesa y para cuándo lo necesitas?",
    "Cliente: Quiero saber precios y disponibilidad.",
    "Bot: Perfecto. Te pido nombre, teléfono, servicio de interés y horario preferido. Con eso dejo tu solicitud registrada para seguimiento.",
    "",
    "Qué automatizaría:",
    "- Respuestas sobre servicios, precios, horarios y ubicación.",
    "- Captura de nombre, teléfono, necesidad y horario preferido.",
    "- Clasificación del lead como nuevo, interesado o requiere atención humana.",
    "- Registro de la conversación completa en el panel.",
    "",
    "Si te interesa implementarlo, deja tu nombre, negocio y teléfono. Con eso te podemos contactar para revisar el proyecto y darte una propuesta."
  ].join("\n");
}
function formatServices(services, business = null) {
  const quoteBased = isQuoteBasedBusiness(business || {});
  return services
    .map((service, index) => {
      const details = [];
      if (!quoteBased && service.durationMinutes) details.push(`${service.durationMinutes} min`);
      if (service.price > 0) details.push(`$${service.price}`);
      if (quoteBased || service.price === 0) details.push("por cotizar");
      return `${index + 1}. ${service.name}${details.length ? ` (${details.join(", ")})` : ""}`;
    })
    .join("\n");
}

function findServiceFromText(services, text) {
  const normalized = normalize(text);
  const numberMatch = normalized.match(/\b(\d+)\b/);
  if (numberMatch) {
    const service = services[Number(numberMatch[1]) - 1];
    if (service) return service;
  }

  return services.find((service) => {
    const serviceName = normalize(service.name);
    const firstWord = serviceName.split(/\s+/)[0];
    return normalized.includes(serviceName) || (firstWord.length > 3 && normalized.includes(firstWord));
  });
}

function findLubriPlanImplementationService(business) {
  return (
    business.services.find((service) => normalize(service.name).includes("implementacion")) ||
    business.services.find((service) => normalize(service.name).includes("lubriplan")) ||
    business.services[0]
  );
}

function isLubriPlanYes(text) {
  const normalized = normalize(text);
  return yesKeywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function isLubriPlanNo(text) {
  const normalized = normalize(text);
  return noKeywords.some((keyword) => normalized === normalize(keyword) || normalized.includes(normalize(keyword)));
}

async function rememberLubriPlanStep(customer, step) {
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: step,
      pendingData: "{}",
      lastIntent: step
    }
  });
}

async function startLubriPlanImplementation(customer, business) {
  const service = findLubriPlanImplementationService(business);
  const data = {
    service: service?.name || "Implementación en planta",
    serviceId: service?.id || null
  };

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: "lubriplan_current_system",
      pendingServiceId: service?.id || null,
      pendingData: JSON.stringify(data),
      lastIntent: "lubriplan_implementation"
    }
  });

  return {
    intent: "lubriplan_implementation",
    status: "auto_replied",
    reply: "Perfecto. Para revisar la implementación de LubriPlan en tu planta, primero dime: ¿con qué sistema llevan actualmente la lubricación? Por ejemplo: Excel, papel, pizarrón, otro software o no tienen un control formal."
  };
}

async function requestLubriPlanContact(customer, business) {
  const data = parsePendingData(customer);
  const service = findLubriPlanImplementationService(business);
  const summary = [
    "Solicitud de implementación LubriPlan",
    `Sistema actual: ${data.currentSystem || "No especificado"}`,
    `Equipos aproximados: ${data.equipmentCount || "No especificado"}`
  ].join("\n");

  const updatedCustomer = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      conversationState: "idle",
      pendingServiceId: service?.id || null,
      pendingData: "{}",
      leadStatus: "contactado",
      needsHuman: true,
      notes: [customer.notes, summary].filter(Boolean).join("\n\n"),
      quoteService: service?.name || "Implementación en planta",
      quoteDetails: `Sistema actual: ${data.currentSystem || "No especificado"}. Equipos aproximados: ${data.equipmentCount || "No especificado"}.`,
      quoteLocation: "",
      quoteUrgency: "",
      lastIntent: "lubriplan_contact_request"
    }
  });

  notifyBusinessLead({ business, customer: updatedCustomer, type: "needs_human" }).catch((error) => {
    console.error("[notifications] LubriPlan notification failed:", error);
  });

  return {
    intent: "lubriplan_contact_request",
    status: "needs_human",
    reply: "Perfecto. Déjame tus datos para que el equipo pueda contactarte y revisar la implementación de LubriPlan en tu planta."
  };
}

async function handleLubriPlanFlow({ business, customer, text }) {
  if (!isLubriPlanBusiness(business)) return null;
  const normalized = normalize(text);
  const state = customer.conversationState || "";
  if (["quote_service", "quote_details", "quote_location", "quote_urgency"].includes(state)) return null;

  if (state === "lubriplan_current_system") {
    const data = { ...parsePendingData(customer), currentSystem: text.trim() };
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "lubriplan_equipment_count",
        pendingData: JSON.stringify(data),
        lastIntent: "lubriplan_current_system"
      }
    });

    return {
      intent: "lubriplan_equipment_count",
      status: "auto_replied",
      reply: "Gracias. ¿Cuántos equipos manejan aproximadamente en la planta? Puede ser un estimado."
    };
  }

  if (state === "lubriplan_equipment_count") {
    const data = { ...parsePendingData(customer), equipmentCount: text.trim() };
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "lubriplan_confirm",
        pendingData: JSON.stringify(data),
        lastIntent: "lubriplan_summary"
      }
    });

    return {
      intent: "lubriplan_summary",
      status: "auto_replied",
      reply: [
        "Perfecto, con eso ya se entiende mejor el punto de partida:",
        "",
        `Sistema actual: ${data.currentSystem || "No especificado"}`,
        `Equipos aproximados: ${data.equipmentCount || "No especificado"}`,
        "",
        "LubriPlan te ayudaría a centralizar rutas, puntos de lubricación, responsables, evidencias y alertas para que el seguimiento no dependa de hojas sueltas o memoria operativa.",
        "",
        "La implementación suele ser relativamente rápida porque se puede iniciar con la carga de equipos, puntos críticos, frecuencias y responsables, sin cambiar toda la operación de golpe.",
        "",
        "¿Te gustaría implementar LubriPlan en tu planta?"
      ].join("\n")
    };
  }

  if (state === "lubriplan_confirm") {
    if (isLubriPlanYes(text)) {
      return requestLubriPlanContact(customer, business);
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "lubriplan_followup", lastIntent: "lubriplan_not_now" }
    });
    return {
      intent: "lubriplan_not_now",
      status: "auto_replied",
      reply: "Claro. Si cambias de opinión, escribe sí y te pido tus datos. También puedo explicarte la promoción actual o cómo funciona LubriPlan."
    };
  }

  if (state === "lubriplan_followup") {
    if (isLubriPlanYes(text)) {
      return requestLubriPlanContact(customer, business);
    }

    if (isLubriPlanNo(text)) {
      return {
        intent: "lubriplan_followup",
        status: "auto_replied",
        reply: "Sin problema. Puedo explicarte qué es LubriPlan, cómo funciona o la promoción actual cuando quieras."
      };
    }
  }

  if (
    normalized.includes("implementar") ||
    normalized.includes("implementacion") ||
    normalized.includes("planta") ||
    normalized.includes("demo") ||
    (state.startsWith("lubriplan_") && isLubriPlanYes(text))
  ) {
    return startLubriPlanImplementation(customer, business);
  }

  if (normalized.includes("promocion") || normalized.includes("gratis") || /^(3|tres|opcion 3)\b/.test(normalized)) {
    await rememberLubriPlanStep(customer, "lubriplan_promo");
    return {
      intent: "lubriplan_promo",
      status: "auto_replied",
      reply: [
        "La promoción actual incluye implementación gratis y 3 meses de LubriPlan gratis.",
        "",
        "Esto ayuda a iniciar el control de lubricación sin costo inicial de arranque.",
        "",
        "¿Quieres que revisemos la implementación para tu planta?"
      ].join("\n")
    };
  }

  if (normalized.includes("como funciona") || /^(2|dos|opcion 2)\b/.test(normalized)) {
    await rememberLubriPlanStep(customer, "lubriplan_how");
    return {
      intent: "lubriplan_how",
      status: "auto_replied",
      reply: [
        "LubriPlan funciona con un panel donde se registran equipos, puntos de lubricación, rutas, frecuencias y responsables.",
        "",
        "El equipo técnico ejecuta actividades, sube evidencias y el sistema permite revisar avances, pendientes, alertas e historial.",
        "",
        "¿Quieres que te explique la implementación en planta o la promoción actual?"
      ].join("\n")
    };
  }

  if (normalized.includes("que es") || normalized.includes("informacion") || /^(1|uno|opcion 1)\b/.test(normalized)) {
    await rememberLubriPlanStep(customer, "lubriplan_info");
    return {
      intent: "lubriplan_info",
      status: "auto_replied",
      reply: [
        "LubriPlan es una plataforma para gestionar la lubricación industrial.",
        "",
        "Ayuda a ordenar equipos, puntos de lubricación, rutas, frecuencias, responsables, evidencias y alertas para que mantenimiento tenga una operación más visible y controlada.",
        "",
        "¿Quieres que te informe sobre implementación o la promoción actual?"
      ].join("\n")
    };
  }

  return null;
}

const WEEKDAYS = [
  ["domingo", 0],
  ["lunes", 1],
  ["martes", 2],
  ["miercoles", 3],
  ["miércoles", 3],
  ["jueves", 4],
  ["viernes", 5],
  ["sabado", 6],
  ["sábado", 6]
];

const PAST_DATE_REPLY =
  "No puedo agendar en fechas que ya pasaron. Dime una fecha futura, por ejemplo: mañana a las 4 pm, este martes a las 2 pm o 27/04 16:00.";

function hasPastDateReference(text) {
  const normalized = normalize(text);
  if (normalized.includes("pasado manana")) return false;

  const directPastWords = [
    "ayer",
    "antier",
    "anteayer",
    "semana pasada",
    "mes pasado",
    "ano pasado",
    "año pasado"
  ];
  if (directPastWords.some((word) => normalized.includes(normalize(word)))) return true;

  return WEEKDAYS.some(([name]) => {
    const day = normalize(name);
    return (
      normalized.includes(`${day} pasado`) ||
      normalized.includes(`${day} pasada`) ||
      normalized.includes(`pasado ${day}`) ||
      normalized.includes(`pasada ${day}`)
    );
  });
}

function hasDateReference(text) {
  const normalized = normalize(text);
  const hasRelativeDate =
    normalized.includes("pasado manana") ||
    normalized.includes("manana") ||
    normalized.includes("hoy") ||
    normalized.includes("semana") ||
    normalized.includes("mes");
  const hasExplicitDate =
    /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.test(normalized) ||
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/.test(normalized);
  const hasWeekday = WEEKDAYS.some(([name]) => normalized.includes(normalize(name)));
  return hasRelativeDate || hasExplicitDate || hasWeekday;
}

function nextWeekdayDate(targetDay, { forceNextWeek = false } = {}) {
  const now = new Date();
  const today = now.getDay();
  let daysAhead = (targetDay - today + 7) % 7;
  if (daysAhead === 0 || forceNextWeek) daysAhead += 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
}

function parseDateTime(text, baseDate = null) {
  const normalized = normalize(text);
  const now = new Date();
  const shouldUseBaseDate = baseDate && !hasDateReference(text);
  let date = shouldUseBaseDate ? new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()) : null;

  const isoMatch = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const slashMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);

  if (normalized.includes("pasado manana")) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  } else if (normalized.includes("manana")) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (normalized.includes("hoy")) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (isoMatch) {
    date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  } else if (slashMatch) {
    const year = slashMatch[3] ? Number(slashMatch[3]) : now.getFullYear();
    date = new Date(year, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
  }

  const weekday = WEEKDAYS.find(([name]) => normalized.includes(normalize(name)));
  if (weekday) {
    const forceNextWeek = normalized.includes("proximo") || normalized.includes("siguiente");
    date = nextWeekdayDate(weekday[1], { forceNextWeek });
  }

  const timeMatches = [...normalized.matchAll(/\b(?:a\s+las\s+|las\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g)];
  const timeMatch =
    timeMatches.find((match) => Boolean(match[2] || match[3])) || timeMatches[timeMatches.length - 1];
  if (!date || !timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const meridiem =
    timeMatch[3] ||
    (normalized.includes("tarde") || normalized.includes("noche")
      ? "pm"
      : normalized.includes("de la manana") || normalized.includes("por la manana")
        ? "am"
        : "");

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;

  date.setHours(hour, minute, 0, 0);
  return date;
}

function looksLikePhone(value) {
  return /^\+?\d[\d\s-]{7,}$/.test(value || "");
}

function formatAppointment(appointment, index = null) {
  const prefix = index === null ? "" : `${index + 1}. `;
  return `${prefix}${appointment.serviceName}, ${appointment.startsAt.toLocaleString("es-MX")}`;
}

function parsePendingData(customer) {
  try {
    return JSON.parse(customer.pendingData || "{}");
  } catch {
    return {};
  }
}

async function findOrCreateCustomer({ businessId, from }) {
  const phone = from || "unknown";
  return prisma.customer.upsert({
    where: { businessId_phone: { businessId, phone } },
    update: {},
    create: {
      businessId,
      phone,
      name: looksLikePhone(phone) || phone === "unknown" ? "Cliente sin identificar" : phone
    }
  });
}

async function loadBusiness(businessId) {
  const include = {
    services: { where: { active: true }, orderBy: { createdAt: "asc" } },
    faqs: { where: { active: true }, orderBy: { createdAt: "asc" } }
  };
  if (isDemoBusinessId(businessId)) return ensureDemoBusiness(businessId, include);
  return businessId
    ? prisma.business.findUnique({ where: { id: businessId }, include })
    : prisma.business.findFirst({ include, orderBy: { createdAt: "asc" } });
}

async function resetCustomer(customerId) {
  await prisma.appointment.updateMany({
    where: { customerId, status: "hold" },
    data: { status: "expired", holdExpiresAt: null }
  });

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      conversationState: "idle",
      pendingServiceId: null,
      pendingStartsAt: null,
      pendingData: "{}"
    }
  });
}

async function getUpcomingAppointments(customerId) {
  return prisma.appointment.findMany({
    where: {
      customerId,
      status: "confirmed",
      startsAt: { gt: new Date() }
    },
    orderBy: { startsAt: "asc" },
    take: 5
  });
}

async function selectAppointmentFromText(customer, text) {
  const appointments = await getUpcomingAppointments(customer.id);
  if (!appointments.length) return { appointments, selected: null };

  const numberMatch = normalize(text).match(/\b(\d+)\b/);
  if (numberMatch) {
    const selected = appointments[Number(numberMatch[1]) - 1];
    if (selected) return { appointments, selected };
  }

  return { appointments, selected: appointments.length === 1 ? appointments[0] : null };
}

async function cancelAppointmentFromConversation({ business, customer, appointment }) {
  const hoursUntilAppointment = (appointment.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
  if (hoursUntilAppointment < business.cancellationMinHours) {
    await resetCustomer(customer.id);
    return `No puedo cancelar automáticamente esa cita porque faltan menos de ${business.cancellationMinHours} horas. Te paso con una persona del equipo para revisarlo.`;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled", holdExpiresAt: null }
  });
  await resetCustomer(customer.id);
  return `Listo, cancele tu cita: ${formatAppointment(appointment)}.`;
}

async function createAppointmentFromState({ business, customer, customerName, customerPhone }) {
  const service = business.services.find((item) => item.id === customer.pendingServiceId);
  if (!service || !customer.pendingStartsAt) return null;

  const cleanName = customerName?.trim() || customer.name || "Cliente sin identificar";
  const cleanPhone = customerPhone?.trim() || customer.phone || "";
  const updatedCustomer = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: cleanName,
      phone: cleanPhone,
      leadStatus: "cita_agendada",
      conversationState: "idle",
      pendingServiceId: null,
      pendingStartsAt: null,
      pendingData: "{}"
    }
  });

  const heldAppointment = await prisma.appointment.findFirst({
    where: {
      businessId: business.id,
      customerId: customer.id,
      serviceId: service.id,
      startsAt: customer.pendingStartsAt,
      status: "hold",
      holdExpiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (heldAppointment) {
    return prisma.appointment.update({
      where: { id: heldAppointment.id },
      data: {
        status: "confirmed",
        customerName: updatedCustomer.name,
        customerPhone: cleanPhone || updatedCustomer.phone,
        holdExpiresAt: null
      }
    });
  }

  const availability = await checkAppointmentAvailability({
    businessId: business.id,
    serviceId: service.id,
    startsAt: customer.pendingStartsAt
  });
  if (!availability.available) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "scheduling_datetime",
        pendingStartsAt: customer.pendingStartsAt,
        pendingData: "{}"
      }
    });

    return {
      unavailable: true,
      reply: `${availabilityMessage(availability)} ¿Cuál te funciona?`
    };
  }

  return prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: updatedCustomer.id,
      serviceId: service.id,
      staffId: availability.staff?.id || null,
      customerName: updatedCustomer.name,
      customerPhone: updatedCustomer.phone,
      serviceName: service.name,
      startsAt: customer.pendingStartsAt,
      notes: "Cita creada desde conversación automática"
    }
  });
}

async function holdDateTimeIfAvailable({ business, customer, service, startsAt }) {
  await prisma.appointment.updateMany({
    where: { customerId: customer.id, status: "hold" },
    data: { status: "expired", holdExpiresAt: null }
  });

  const availability = await checkAppointmentAvailability({
    businessId: business.id,
    serviceId: service.id,
    startsAt
  });

  if (!availability.available) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "scheduling_datetime",
        pendingServiceId: service.id,
        pendingStartsAt: startsAt
      }
    });

    return {
      available: false,
      reply: `${availabilityMessage(availability)} ¿Cuál te funciona?`
    };
  }

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      serviceId: service.id,
      staffId: availability.staff?.id || null,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceName: service.name,
      startsAt,
      status: "hold",
      holdExpiresAt: addMinutes(new Date(), business.holdMinutes),
      notes: "Apartado temporal desde conversación automática"
    }
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { conversationState: "scheduling_name", pendingStartsAt: startsAt }
  });

  if (APPOINTMENT_DEMO_IDS.includes(business.id)) {
    return {
      available: true,
      reply: `Listo, te aparto ese horario por ${business.holdMinutes} minutos. Para confirmar la cita, compárteme solo tu teléfono / WhatsApp.`
    };
  }

  return {
    available: true,
    reply: `Listo, te aparto ese horario por ${business.holdMinutes} minutos. ¿A qué nombre registro la cita?`
  };
}

async function buildStateReply({ business, customer, text }) {
  if (customer.botPaused) {
    await prisma.customer.update({ where: { id: customer.id }, data: { needsHuman: true, lastIntent: "bot_paused" } });
    return {
      intent: "bot_paused",
      status: "needs_human",
      reply: "Gracias por escribir. Una persona del equipo está atendiendo esta conversación y te respondera pronto."
    };
  }

  if (business.id === PROJECTS_DEMO_ID) {
    if (customer.conversationState === "project_diagnostic") {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          conversationState: "idle",
          leadStatus: "contactado",
          notes: [customer.notes, `Diagnóstico web: ${text}`].filter(Boolean).join("\n\n")
        }
      });
      return {
        intent: "project_diagnostic_example",
        status: "auto_replied",
        reply: projectDiagnosticExample(text)
      };
    }

    if (["idle", "", null].includes(customer.conversationState)) {
      if (!hasProjectDiagnosticInfo(text)) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { conversationState: "project_diagnostic", lastIntent: "project_diagnostic_request" }
        });
        return {
          intent: "project_diagnostic_request",
          status: "auto_replied",
          reply: projectDiagnosticRequest()
        };
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          leadStatus: "contactado",
          notes: [customer.notes, `Diagnóstico web: ${text}`].filter(Boolean).join("\n\n")
        }
      });
      return {
        intent: "project_diagnostic_example",
        status: "auto_replied",
        reply: projectDiagnosticExample(text)
      };
    }
  }

  if (normalize(text) === "estado") {
    return {
      intent: "debug_state",
      status: "auto_replied",
      reply: `Estoy en estado: ${customer.conversationState}. Si quieres empezar de nuevo, escribe reset.`
    };
  }

  const lubriPlanReply = await handleLubriPlanFlow({ business, customer, text });
  if (lubriPlanReply) return lubriPlanReply;

  if (customer.conversationState === "cancelling_select") {
    const { appointments, selected } = await selectAppointmentFromText(customer, text);
    if (!selected) {
      return {
        intent: "cancelling_select",
        status: "scheduling",
        reply: `Dime el número de la cita que quieres cancelar:\n${appointments.map(formatAppointment).join("\n")}`
      };
    }

    return {
      intent: "appointment_cancelled",
      status: "appointment_cancelled",
      reply: await cancelAppointmentFromConversation({ business, customer, appointment: selected })
    };
  }

  if (customer.conversationState === "rescheduling_select") {
    const { appointments, selected } = await selectAppointmentFromText(customer, text);
    if (!selected) {
      return {
        intent: "rescheduling_select",
        status: "scheduling",
        reply: `Dime el número de la cita que quieres reagendar:\n${appointments.map(formatAppointment).join("\n")}`
      };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        conversationState: "rescheduling_datetime",
        pendingServiceId: selected.serviceId,
        pendingStartsAt: selected.startsAt,
        pendingData: JSON.stringify({ appointmentId: selected.id })
      }
    });

    return {
      intent: "rescheduling_datetime",
      status: "scheduling",
      reply: `Claro. ¿Para qué nuevo día y hora quieres mover tu cita de ${selected.serviceName}?`
    };
  }

  if (customer.conversationState === "rescheduling_datetime") {
    const pending = parsePendingData(customer);
    if (hasPastDateReference(text)) {
      return {
        intent: "rescheduling_past_date",
        status: "scheduling",
        reply: "No puedo reagendar a una fecha que ya pasó. Dime una fecha futura, por ejemplo: mañana a las 4 pm o 27/04 16:00."
      };
    }

    const startsAt = parseDateTime(text, customer.pendingStartsAt);
    if (!startsAt) {
      return {
        intent: "rescheduling_datetime",
        status: "scheduling",
        reply: "Me falta el nuevo día y hora. Puedes escribirlo como: mañana a las 4 pm o 27/04 16:00."
      };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: pending.appointmentId },
      include: { business: true }
    });
    if (!appointment) {
      await resetCustomer(customer.id);
      return {
        intent: "rescheduling_error",
        status: "needs_human",
        reply: "No encontré esa cita. Te paso con una persona del equipo para revisarlo."
      };
    }

    const hoursUntilAppointment = (appointment.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilAppointment < business.cancellationMinHours) {
      await resetCustomer(customer.id);
      return {
        intent: "rescheduling_closed",
        status: "needs_human",
        reply: `Solo puedo reagendar automáticamente con al menos ${business.cancellationMinHours} horas de anticipación. Te paso con una persona del equipo.`
      };
    }

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "rescheduling" } });
    const availability = await checkAppointmentAvailability({
      businessId: business.id,
      serviceId: appointment.serviceId,
      startsAt
    });

    if (!availability.available) {
      await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "confirmed" } });
      return {
        intent: "rescheduling_unavailable",
        status: "scheduling",
        reply: `${availabilityMessage(availability)} ¿Cuál te funciona?`
      };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "confirmed",
        startsAt,
        staffId: availability.staff?.id || null,
        holdExpiresAt: null
      }
    });
    await resetCustomer(customer.id);

    return {
      intent: "appointment_rescheduled",
      status: "appointment_rescheduled",
      reply: `Listo, reagende tu cita: ${formatAppointment(updated)}.`
    };
  }

  if (includesAny(text, cancelAppointmentKeywords)) {
    const { appointments, selected } = await selectAppointmentFromText(customer, text);
    if (!appointments.length) {
      return {
        intent: "no_appointments",
        status: "auto_replied",
        reply: "No encontré citas futuras con este teléfono. Si usaste otro número, escribeme desde ese número o te paso con una persona."
      };
    }
    if (selected) {
      return {
        intent: "appointment_cancelled",
        status: "appointment_cancelled",
        reply: await cancelAppointmentFromConversation({ business, customer, appointment: selected })
      };
    }
    await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: "cancelling_select" } });
    return {
      intent: "cancelling_select",
      status: "scheduling",
      reply: `Claro. Dime el número de la cita que quieres cancelar:\n${appointments.map(formatAppointment).join("\n")}`
    };
  }

  if (includesAny(text, rescheduleKeywords)) {
    const { appointments, selected } = await selectAppointmentFromText(customer, text);
    if (!appointments.length) {
      return {
        intent: "no_appointments",
        status: "auto_replied",
        reply: "No encontré citas futuras con este teléfono. Si usaste otro número, escribeme desde ese número o te paso con una persona."
      };
    }
    if (selected) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          conversationState: "rescheduling_datetime",
          pendingServiceId: selected.serviceId,
          pendingStartsAt: selected.startsAt,
          pendingData: JSON.stringify({ appointmentId: selected.id })
        }
      });
      return {
        intent: "rescheduling_datetime",
        status: "scheduling",
        reply: `Claro. ¿Para qué nuevo día y hora quieres mover tu cita de ${selected.serviceName}?`
      };
    }
    await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: "rescheduling_select" } });
    return {
      intent: "rescheduling_select",
      status: "scheduling",
      reply: `Claro. Dime el número de la cita que quieres reagendar:\n${appointments.map(formatAppointment).join("\n")}`
    };
  }

  if (includesAny(text, cancelKeywords)) {
    await resetCustomer(customer.id);
    return {
      intent: "reset",
      status: "auto_replied",
      reply: `Listo, empezamos de nuevo.\n\n${mainMenuReply(business)}`
    };
  }

  if (includesAny(text, humanKeywords)) {
    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "needs_human", needsHuman: true, lastIntent: "needs_human" }
    });
    notifyNeedsHuman(business, updatedCustomer);
    return {
      intent: "needs_human",
      status: "needs_human",
      reply: "Claro, te voy a pasar con una persona del equipo para que te atienda."
    };
  }

  if (customer.conversationState === "main_menu") {
    const choice = detectMainMenuChoice(text, business);

    if (choice?.startsWith("lubriplan_")) {
      const lubriPlanChoiceReply = await handleLubriPlanFlow({ business, customer, text });
      if (lubriPlanChoiceReply) return lubriPlanChoiceReply;
    }

    if (choice === "services") {
      return startServiceSelection(customer, business);
    }

    if (choice === "quote") {
      return startQuoteFlow(customer, business, text);
    }

    if (choice === "schedule") {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: "scheduling_service", pendingData: "{}" }
      });
      return {
        intent: "scheduling_service",
        status: "scheduling",
        reply: `Con gusto te ayudo a agendar. Estos son nuestros servicios:\n${formatServices(business.services, business)}\n\nDime el número o nombre del servicio.`
      };
    }

    if (choice === "human") {
      const updatedCustomer = await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: "needs_human", needsHuman: true, lastIntent: "needs_human" }
      });
      notifyNeedsHuman(business, updatedCustomer);
      return {
        intent: "needs_human",
        status: "needs_human",
        reply: "Claro, dejo esta conversación marcada para atención de una persona del equipo."
      };
    }

    return {
      intent: "main_menu",
      status: "auto_replied",
      reply: `No estoy seguro de qué opción necesitas. Responde 1, 2 o 3, o escribe servicios, cotización o atención.\n\n${mainMenuReply(business)}`
    };
  }

  if (customer.conversationState === "select_service") {
    const service = findServiceFromContext({ business, customer, text });

    if (service) {
      return handleServiceSelection({ business, customer, service });
    }

    return {
      intent: "select_service",
      status: "auto_replied",
      reply: [
        "No encontré esa opción en la lista.",
        "",
        servicesReply(business)
      ].join("\n")
    };
  }

  if (customer.conversationState === "service_connector") {
    const data = parsePendingData(customer);
    const service = business.services.find((item) => item.id === data.serviceId || normalize(item.name) === normalize(data.service));

    if (wantsAnotherService(text)) {
      return startServiceSelection(customer, business);
    }

    if (wantsConnectorQuote(text) || includesAny(text, strongQuoteKeywords)) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          conversationState: "quote_details",
          pendingServiceId: service?.id || null,
          pendingData: JSON.stringify({
            ...data,
            service: service?.name || data.service || ""
          }),
          lastIntent: "quote_service_selected"
        }
      });

      return {
        intent: "quote_details",
        status: "auto_replied",
        reply: quoteDetailQuestion(business, "quote_details")
      };
    }

    return {
      intent: "service_connector",
      status: "auto_replied",
      reply: [
        "¿Quieres avanzar con una cotización o prefieres ver otro servicio?",
        "",
        service ? serviceConnectorReply(service) : servicesReply(business)
      ].join("\n")
    };
  }

  if (["quote_service", "quote_details", "quote_location", "quote_urgency"].includes(customer.conversationState)) {
    const data = parsePendingData(customer);

    if (customer.conversationState === "quote_service") {
      const service = findServiceFromText(business.services, text);
      if (!service && includesAny(text, servicesKeywords)) {
        return {
          intent: "quote_service",
          status: "auto_replied",
          reply: quoteIntroReply(business)
        };
      }

      if (service) {
        return handleServiceSelection({ business, customer, service });
      }

      data.service = text.trim();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: "quote_details", pendingData: JSON.stringify(data) }
      });

      return {
        intent: "quote_details",
        status: "auto_replied",
        reply: quoteDetailQuestion(business, "quote_details")
      };
    }

    if (customer.conversationState === "quote_details") {
      data.details = text.trim();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: "quote_location", pendingData: JSON.stringify(data) }
      });

      return {
        intent: "quote_location",
        status: "auto_replied",
        reply: quoteDetailQuestion(business, "quote_location")
      };
    }

    if (customer.conversationState === "quote_location") {
      data.location = text.trim();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { conversationState: "quote_urgency", pendingData: JSON.stringify(data) }
      });

      return {
        intent: "quote_urgency",
        status: "auto_replied",
        reply: quoteDetailQuestion(business, "quote_urgency")
      };
    }

    data.urgency = text.trim();
    return completeQuoteFlow(customer, data, business);
  }

  if (customer.conversationState === "scheduling_service") {
    const service = findServiceFromText(business.services, text);
    if (!service) {
      return {
        intent: "scheduling_service",
        status: "scheduling",
        reply: `Para ayudarte, dime el número o nombre del servicio:\n${formatServices(business.services, business)}`
      };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: "scheduling_datetime", pendingServiceId: service.id }
    });

    return {
      intent: "scheduling_datetime",
      status: "scheduling",
      reply: `Perfecto, ${service.name}. ¿Qué día y hora te conviene? Por ejemplo: mañana a las 4 pm o 27/04 16:00.`
    };
  }

  if (customer.conversationState === "scheduling_datetime") {
    if (hasPastDateReference(text)) {
      return {
        intent: "scheduling_past_date",
        status: "scheduling",
        reply: PAST_DATE_REPLY
      };
    }

    const startsAt = parseDateTime(text, customer.pendingStartsAt);
    if (!startsAt) {
      return {
        intent: "scheduling_datetime",
        status: "scheduling",
        reply: "Me falta el día y la hora. Puedes escribirlo como: este martes a las 2 pm, mañana a las 4 pm o 27/04 16:00. Si quieres empezar de nuevo, escribe reset."
      };
    }

    const service = business.services.find((item) => item.id === customer.pendingServiceId);
    if (!service) {
      await prisma.customer.update({ where: { id: customer.id }, data: { conversationState: "scheduling_service" } });
      return {
        intent: "scheduling_service",
        status: "scheduling",
        reply: `Me falta el servicio. Dime el número o nombre:\n${formatServices(business.services, business)}`
      };
    }

    const holdResult = await holdDateTimeIfAvailable({ business, customer, service, startsAt });
    return {
      intent: holdResult.available ? "scheduling_name" : "scheduling_unavailable",
      status: "scheduling",
      reply: holdResult.reply
    };
  }

  if (customer.conversationState === "scheduling_name") {
    const isAppointmentDemo = APPOINTMENT_DEMO_IDS.includes(business.id);
    const appointment = await createAppointmentFromState({
      business,
      customer,
      customerName: isAppointmentDemo ? "Cliente demo" : text,
      customerPhone: isAppointmentDemo ? text : undefined
    });
    if (appointment?.unavailable) {
      return {
        intent: "scheduling_unavailable",
        status: "scheduling",
        reply: appointment.reply
      };
    }

    if (!appointment) {
      await resetCustomer(customer.id);
      return {
        intent: "scheduling_error",
        status: "needs_human",
        reply: "No pude confirmar la cita con los datos actuales. Te paso con una persona del equipo para revisarlo."
      };
    }

    return {
      intent: "appointment_confirmed",
      status: "appointment_confirmed",
      reply: isAppointmentDemo
        ? `Cita confirmada. Te esperamos para ${appointment.serviceName} el ${appointment.startsAt.toLocaleString("es-MX")}. Confirmación enviada al teléfono ${appointment.customerPhone}.`
        : `Cita confirmada para ${appointment.customerName}: ${appointment.serviceName}, ${appointment.startsAt.toLocaleString("es-MX")}.`
    };
  }

  if (isGreetingOrShortHelp(text)) {
    return startMainMenu(customer, business);
  }

  if (isQuoteBasedBusiness(business) && includesAny(text, strongQuoteKeywords)) {
    return startQuoteFlow(customer, business, text);
  }

  if (includesAny(text, servicesKeywords)) {
    return startServiceSelection(customer, business);
  }

  const matchedFaq = business.faqs.find((faq) => normalize(text).includes(normalize(faq.question)));
  if (includesAny(text, scheduleKeywords)) {
    if (hasPastDateReference(text)) {
      return {
        intent: "scheduling_past_date",
        status: "scheduling",
        reply: PAST_DATE_REPLY
      };
    }

    const service = findServiceFromText(business.services, text);
    const startsAt = parseDateTime(text);

    if (service && startsAt) {
      await prisma.customer.update({ where: { id: customer.id }, data: { pendingServiceId: service.id } });
      const holdResult = await holdDateTimeIfAvailable({ business, customer, service, startsAt });
      return {
        intent: holdResult.available ? "scheduling_name" : "scheduling_unavailable",
        status: "scheduling",
        reply: holdResult.available && APPOINTMENT_DEMO_IDS.includes(business.id)
          ? "Tengo servicio, día y hora. Para confirmar la cita, compárteme solo tu teléfono / WhatsApp."
          : holdResult.available ? "Tengo servicio, día y hora. ¿A qué nombre registro la cita?" : holdResult.reply
      };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { conversationState: service ? "scheduling_datetime" : "scheduling_service", pendingServiceId: service?.id || null }
    });

    return service
      ? {
          intent: "scheduling_datetime",
          status: "scheduling",
          reply: `Perfecto, ${service.name}. ¿Qué día y hora te conviene?`
        }
      : {
          intent: "scheduling_service",
          status: "scheduling",
          reply: `Con gusto te ayudo. Estos son nuestros servicios:\n${formatServices(business.services, business)}\n\nDime el número o nombre del servicio.`
        };
  }

  if (matchedFaq) {
    return { intent: "faq", status: "auto_replied", reply: matchedFaq.answer };
  }

  return startMainMenu(customer, business);
}

export async function answerMessage({ businessId, from, text, channel = "web_or_whatsapp" }) {
  const business = await loadBusiness(businessId);
  if (!business) throw Object.assign(new Error("No business configured"), { status: 400 });

  const customer = await findOrCreateCustomer({ businessId: business.id, from });
  const fallback = await buildStateReply({ business, customer, text });
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      needsHuman: customer.needsHuman || fallback.status === "needs_human",
      lastIntent: fallback.intent
    }
  });
  const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  const recentConversations = await prisma.conversation.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  let reply = fallback.reply;

  if (["general", "faq"].includes(fallback.intent) && !APPOINTMENT_DEMO_IDS.includes(business.id)) {
    try {
      const aiReply = await generateBusinessReply({
        business,
        customer: updatedCustomer,
        recentConversations: recentConversations.reverse(),
        customerText: text,
        intent: fallback.intent,
        fallbackReply: fallback.reply
      });
      if (aiReply) reply = aiReply;
    } catch (error) {
      console.warn("OpenAI reply failed, using fallback reply:", error.message);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      channel,
      from: from || customer.phone,
      inboundText: text,
      outboundText: reply,
      status: fallback.status
    }
  });

  const latestCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  const contactConfig = contactFieldsForCustomer(latestCustomer, business);

  return {
    ...conversation,
    serviceName: contactConfig.serviceName,
    contactFields: contactConfig.contactFields
  };
}
