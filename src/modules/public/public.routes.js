import { Router } from "express";
import { prisma } from "../../prisma.js";

export const publicRouter = Router();

function defaultInitialMessage(business) {
  if (!business) return "Hola. Puedo ayudarte con información, servicios y solicitudes.";
  if (business.niche === "industrial") {
    return `Hola. Soy el asistente de ${business.name}. Puedo ayudarte con información de servicios industriales y solicitudes de cotización.`;
  }
  if (["servicios", "proyectos", "inmobiliaria", "educacion"].includes(business.niche)) {
    return `Hola. Soy el asistente de ${business.name}. Cuéntame qué necesitas y te ayudo a registrar tu solicitud.`;
  }
  return `Hola. Soy el asistente de ${business.name}. Puedo ayudarte con información, servicios, horarios y solicitudes.`;
}

function parseContactFields(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : ["name", "phone"];
  } catch {
    return ["name", "phone"];
  }
}

function parseQuickReplies(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.label && item?.value).slice(0, 6) : [];
  } catch {
    return [];
  }
}

publicRouter.get("/businesses/:businessId/widget", async (req, res, next) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: {
        id: true,
        name: true,
        niche: true,
        widgetTitle: true,
        widgetIntro: true,
        widgetInitialMessage: true,
        widgetPrompt: true,
        widgetStyle: true,
        widgetPrimaryColor: true,
        widgetSecondaryColor: true,
        widgetAccentColor: true,
        widgetBackgroundColor: true,
        widgetLauncherText: true,
        widgetAvatarText: true,
        widgetPosition: true,
        widgetRadius: true,
        widgetQuickReplies: true,
        widgetContactTitle: true,
        widgetContactIntro: true,
        services: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, contactFields: true }
        }
      }
    });

    if (!business) return res.status(404).json({ error: "Business not found" });

    res.json({
      title: business.widgetTitle || "Asistente",
      intro: business.widgetIntro || "Deja tus datos para responderte y dar seguimiento a tu solicitud.",
      hello: business.widgetInitialMessage || defaultInitialMessage(business),
      prompt: business.widgetPrompt || "Quiero información sobre sus servicios",
      style: business.widgetStyle || "premium",
      primaryColor: business.widgetPrimaryColor || "#1f5c50",
      secondaryColor: business.widgetSecondaryColor || "#2f7a68",
      accentColor: business.widgetAccentColor || "#c66d42",
      backgroundColor: business.widgetBackgroundColor || "#f7f8f6",
      launcherText: business.widgetLauncherText || "Chat",
      avatarText: business.widgetAvatarText || "AI",
      position: business.widgetPosition || "right",
      radius: business.widgetRadius || 24,
      quickReplies: parseQuickReplies(business.widgetQuickReplies),
      contactTitle: business.widgetContactTitle || "Datos de contacto",
      contactIntro: business.widgetContactIntro || "Para que el equipo pueda darte seguimiento, déjame tus datos.",
      services: business.services.map((service) => ({
        id: service.id,
        name: service.name,
        contactFields: parseContactFields(service.contactFields)
      }))
    });
  } catch (error) {
    next(error);
  }
});
