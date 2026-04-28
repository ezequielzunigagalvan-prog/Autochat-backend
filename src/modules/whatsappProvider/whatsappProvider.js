import { sendDialog360Message } from "./dialog360Provider.js";
import { sendMetaMessage } from "./metaProvider.js";
import { sendTwilioMessage } from "./twilioProvider.js";

export function getWhatsappProviderName(business) {
  return business?.whatsappProvider || "none";
}

export async function sendWhatsappMessage({ business, to, body }) {
  const provider = getWhatsappProviderName(business);

  if (provider === "none") return null;

  if (provider === "meta") {
    return sendMetaMessage({ business, to, body });
  }

  if (provider === "360dialog") {
    return sendDialog360Message({ business, to, body });
  }

  return sendTwilioMessage({ business, to, body });
}
