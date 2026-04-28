import { sendWhatsappMessage as sendTwilioWhatsappMessage } from "../twilio/twilioClient.js";

export async function sendTwilioMessage({ business, to, body }) {
  const from = process.env.TWILIO_WHATSAPP_FROM || business?.whatsappSender;
  if (!from) return null;

  const result = await sendTwilioWhatsappMessage({ from, to, body });
  if (!result) return null;

  return {
    provider: "twilio",
    id: result.sid,
    status: result.status,
    raw: result
  };
}
