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
        widgetPrompt: true
      }
    });

    if (!business) return res.status(404).json({ error: "Business not found" });

    res.json({
      title: business.widgetTitle || "Asistente",
      intro: business.widgetIntro || "Deja tus datos para responderte y dar seguimiento a tu solicitud.",
      hello: business.widgetInitialMessage || defaultInitialMessage(business),
      prompt: business.widgetPrompt || "Quiero información sobre sus servicios"
    });
  } catch (error) {
    next(error);
  }
});
