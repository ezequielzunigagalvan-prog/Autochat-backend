import { Router } from "express";
import { prisma } from "../../prisma.js";
import { answerMessage } from "../chat/chatEngine.js";
import { parseMetaWebhook, sendMetaMessage } from "../whatsappProvider/metaProvider.js";

export const metaWhatsappRouter = Router();

async function findBusinessForMetaWebhook(event) {
  if (event?.phoneNumberId) {
    const business = await prisma.business.findFirst({
      where: {
        whatsappProvider: "meta",
        metaPhoneNumberId: event.phoneNumberId
      }
    });
    if (business) return business;
  }

  if (event?.displayPhoneNumber) {
    const display = event.displayPhoneNumber.replace(/\s/g, "");
    const business = await prisma.business.findFirst({
      where: {
        whatsappProvider: "meta",
        whatsappSender: { contains: display }
      }
    });
    if (business) return business;
  }

  return prisma.business.findFirst({
    where: { whatsappProvider: "meta" },
    orderBy: { createdAt: "asc" }
  });
}

metaWhatsappRouter.get("/", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const configuredToken = process.env.META_WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && token === configuredToken) {
    return res.status(200).send(challenge);
  }

  if (mode === "subscribe" && token) {
    const business = await prisma.business.findFirst({
      where: {
        whatsappProvider: "meta",
        metaVerifyToken: String(token)
      }
    });
    if (business) return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

metaWhatsappRouter.post("/", async (req, res) => {
  try {
    const event = parseMetaWebhook(req.body);
    if (!event) return res.sendStatus(200);

    console.log(`[meta-whatsapp] from=${event.from} phoneNumberId=${event.phoneNumberId} body="${event.text}"`);

    const business = await findBusinessForMetaWebhook(event);
    if (!business) {
      console.warn("[meta-whatsapp] no business configured for webhook");
      return res.sendStatus(200);
    }

    if (!event.text) {
      await sendMetaMessage({
        business,
        to: event.from,
        body: "No pude leer tu mensaje. Puedes escribir hola, servicios o agendar una cita."
      });
      return res.sendStatus(200);
    }

    const conversation = await answerMessage({
      businessId: business.id,
      from: event.from,
      text: event.text,
      channel: "whatsapp_meta"
    });

    const reply = conversation.outboundText;
    console.log(`[meta-whatsapp] reply="${reply.slice(0, 160)}"`);

    await sendMetaMessage({
      business,
      to: event.from,
      body: reply
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error("Meta WhatsApp webhook failed:", error);
    return res.sendStatus(200);
  }
});
