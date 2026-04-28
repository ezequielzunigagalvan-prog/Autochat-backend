import { Router } from "express";
import { prisma } from "../../prisma.js";
import { answerMessage } from "../chat/chatEngine.js";
import { parseMetaWebhook } from "../whatsappProvider/metaProvider.js";
import { sendDialog360Message } from "../whatsappProvider/dialog360Provider.js";

export const dialog360WhatsappRouter = Router();

async function findBusinessForDialog360Webhook(event) {
  if (event?.phoneNumberId) {
    const business = await prisma.business.findFirst({
      where: {
        whatsappProvider: "360dialog",
        dialog360ChannelId: event.phoneNumberId
      }
    });
    if (business) return business;
  }

  if (event?.displayPhoneNumber) {
    const display = event.displayPhoneNumber.replace(/\s/g, "");
    const business = await prisma.business.findFirst({
      where: {
        whatsappProvider: "360dialog",
        whatsappSender: { contains: display }
      }
    });
    if (business) return business;
  }

  return prisma.business.findFirst({
    where: { whatsappProvider: "360dialog" },
    orderBy: { createdAt: "asc" }
  });
}

dialog360WhatsappRouter.post("/", async (req, res) => {
  try {
    const event = parseMetaWebhook(req.body);
    if (!event) return res.sendStatus(200);

    console.log(`[360dialog-whatsapp] from=${event.from} phoneNumberId=${event.phoneNumberId} body="${event.text}"`);

    const business = await findBusinessForDialog360Webhook(event);
    if (!business) {
      console.warn("[360dialog-whatsapp] no business configured for webhook");
      return res.sendStatus(200);
    }

    if (!event.text) {
      await sendDialog360Message({
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
      channel: "whatsapp_360dialog"
    });

    const reply = conversation.outboundText;
    console.log(`[360dialog-whatsapp] reply="${reply.slice(0, 160)}"`);

    await sendDialog360Message({
      business,
      to: event.from,
      body: reply
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error("360dialog WhatsApp webhook failed:", error);
    return res.sendStatus(200);
  }
});
