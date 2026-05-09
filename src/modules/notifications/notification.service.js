import nodemailer from "nodemailer";

function hasEmailConfig() {
  return Boolean(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_FROM
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function formatCustomerSummary(customer) {
  return [
    `Cliente: ${customer.name || "Sin nombre"}`,
    `Telefono: ${customer.phone || "Sin telefono"}`,
    `Correo: ${customer.email || "Sin correo"}`,
    `Empresa: ${customer.company || "Sin empresa"}`,
    `Estado: ${customer.leadStatus || "nuevo"}`,
    "",
    "Solicitud:",
    `Servicio: ${customer.quoteService || "No especificado"}`,
    `Detalles: ${customer.quoteDetails || "No especificados"}`,
    `Ubicacion: ${customer.quoteLocation || "No especificada"}`,
    `Urgencia: ${customer.quoteUrgency || "No especificada"}`,
    "",
    `Notas: ${customer.notes || "Sin notas"}`
  ].join("\n");
}

export async function notifyBusinessLead({ business, customer, type = "lead" }) {
  try {
    if (!hasEmailConfig()) {
      console.warn("[notifications] email config missing");
      return null;
    }

    if (!business?.notificationEmail) {
      console.warn("[notifications] business notificationEmail missing");
      return null;
    }

    const transporter = createTransporter();
    const subjectMap = {
      quote_complete: `Nueva cotizacion completa - ${business.name}`,
      needs_human: `Cliente requiere atencion - ${business.name}`,
      appointment_confirmed: `Nueva cita confirmada - ${business.name}`,
      lead: `Nuevo lead - ${business.name}`
    };

    return transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "AutoChat"}" <${process.env.EMAIL_FROM}>`,
      to: business.notificationEmail,
      subject: subjectMap[type] || subjectMap.lead,
      text: [
        `AutoChat detecto una nueva solicitud para ${business.name}.`,
        "",
        formatCustomerSummary(customer),
        "",
        "Entra al panel para revisar la conversacion y dar seguimiento."
      ].join("\n")
    });
  } catch (error) {
    console.error("[notifications] failed:", error);
    return null;
  }
}
