import { Router } from "express";
import { answerMessage } from "../chat/chatEngine.js";

export const whatsappRouter = Router();

whatsappRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

whatsappRouter.post("/", async (req, res, next) => {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from || "unknown";
    const text = message?.text?.body || "";

    if (text) {
      await answerMessage({
        businessId: req.query.businessId ? String(req.query.businessId) : undefined,
        from,
        text,
        channel: "whatsapp"
      });
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});