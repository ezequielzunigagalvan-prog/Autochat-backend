import { Router } from "express";
import { prisma } from "../../prisma.js";
import { answerMessage } from "../chat/chatEngine.js";

export const twilioWhatsappRouter = Router();

function normalizeWhatsapp(value) {
  return String(value || "").trim();
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sendTwiml(res, message) {
  const xml = `<Response><Message>${escapeXml(message)}</Message></Response>`;
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(xml);
}

function sendEmptyTwiml(res) {
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end("<Response></Response>");
}

async function findBusinessForTwilioNumber(to) {
  const sender = normalizeWhatsapp(to);
  if (sender) {
    const business = await prisma.business.findFirst({
      where: { whatsappSender: sender }
    });
    if (business) return business;
  }

  return prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
}

twilioWhatsappRouter.post("/", async (req, res, next) => {
  try {
    const from = normalizeWhatsapp(req.body.From);
    const to = normalizeWhatsapp(req.body.To);
    const text = String(req.body.Body || "").trim();
    console.log(`[twilio-whatsapp] from=${from} to=${to} body="${text}"`);

    if (!text) {
      sendTwiml(res, "No pude leer tu mensaje. Puedes escribir hola, servicios o agendar una cita.");
      return;
    }

    const business = await findBusinessForTwilioNumber(to);
    if (!business) {
      sendTwiml(res, "Este asistente aun no tiene un negocio configurado.");
      return;
    }

    const conversation = await answerMessage({
      businessId: business.id,
      from,
      text,
      channel: "whatsapp_twilio"
    });

    const reply = conversation.outboundText;

    console.log(`[twilio-whatsapp] reply="${reply.slice(0, 160)}"`);
    sendTwiml(res, reply);
  } catch (error) {
    console.error("Twilio WhatsApp webhook failed:", error);
    sendTwiml(res, "Tuve un problema procesando tu mensaje. Intenta de nuevo en un momento o pide hablar con una persona.");
  }
});
