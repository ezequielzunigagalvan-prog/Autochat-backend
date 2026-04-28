const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v22.0";

function getMetaConfig(business) {
  return {
    phoneNumberId: business?.metaPhoneNumberId || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: business?.metaAccessToken || process.env.META_WHATSAPP_ACCESS_TOKEN || ""
  };
}

export function getMetaVerifyToken(business) {
  return business?.metaVerifyToken || process.env.META_WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "";
}

export async function sendMetaMessage({ business, to, body }) {
  const { phoneNumberId, accessToken } = getMetaConfig(business);
  if (!phoneNumberId || !accessToken) return null;

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: String(to || "").replace(/^whatsapp:/, "").replace(/\D/g, ""),
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Meta WhatsApp send failed");
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload;
    throw error;
  }

  return {
    provider: "meta",
    id: payload.messages?.[0]?.id || "",
    status: payload.messages?.[0]?.message_status || "sent",
    raw: payload
  };
}

export function parseMetaWebhook(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  return {
    phoneNumberId: value?.metadata?.phone_number_id || "",
    displayPhoneNumber: value?.metadata?.display_phone_number || "",
    from: message.from ? `whatsapp:+${message.from.replace(/^\+/, "")}` : "unknown",
    text: message.text?.body || "",
    messageId: message.id || "",
    timestamp: message.timestamp || ""
  };
}
