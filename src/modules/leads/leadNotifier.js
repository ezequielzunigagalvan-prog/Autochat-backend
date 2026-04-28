async function sendLeadWebhook(payload) {
  if (!process.env.LEAD_WEBHOOK_URL) return null;

  const response = await fetch(process.env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error(`Lead webhook failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function notifyLead({ business, customer, source = "widget_web" }) {
  const payload = {
    source,
    businessId: business.id,
    businessName: business.name,
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    createdAt: new Date().toISOString()
  };

  console.log("[lead]", JSON.stringify(payload));

  return {
    payload,
    webhook: await sendLeadWebhook(payload)
  };
}
