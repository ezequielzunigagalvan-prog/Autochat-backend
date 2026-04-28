const DIALOG360_BASE_URL = process.env.DIALOG360_BASE_URL || "https://waba-v2.360dialog.io";

function getDialog360ApiKey(business) {
  return business?.dialog360ApiKey || process.env.DIALOG360_API_KEY || "";
}

export async function sendDialog360Message({ business, to, body }) {
  const apiKey = getDialog360ApiKey(business);
  if (!apiKey) return null;

  const response = await fetch(`${DIALOG360_BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "D360-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to || "").replace(/^whatsapp:\+?/, ""),
      type: "text",
      text: { body }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "360dialog WhatsApp send failed");
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload;
    throw error;
  }

  return {
    provider: "360dialog",
    id: payload.messages?.[0]?.id || "",
    status: payload.messages?.[0]?.message_status || "sent",
    raw: payload
  };
}
