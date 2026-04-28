import twilio from "twilio";

export function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendWhatsappMessage({ from, to, body }) {
  const client = getTwilioClient();
  if (!client) return null;

  return client.messages.create({
    from,
    to,
    body
  });
}
