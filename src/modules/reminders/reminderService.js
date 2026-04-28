import { prisma } from "../../prisma.js";
import { sendWhatsappMessage } from "../whatsappProvider/whatsappProvider.js";

const REMINDER_TYPES = [
  { type: "reminder_24h", minutesBefore: 24 * 60 },
  { type: "reminder_2h", minutesBefore: 2 * 60 }
];

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function renderTemplate(template, context) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => context[key] ?? "");
}

function appointmentContext(appointment) {
  return {
    business: appointment.business.name,
    customer: appointment.customerName,
    service: appointment.serviceName,
    date: appointment.startsAt.toLocaleString("es-MX"),
    time: appointment.startsAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  };
}

async function getTemplate({ businessId, key }) {
  const template = await prisma.messageTemplate.findFirst({
    where: { businessId, key, active: true }
  });
  if (template) return template.body;

  if (key === "reminder_24h") {
    return "Recordatorio: mañana tienes cita en {{business}} a las {{time}} para {{service}}.";
  }
  if (key === "reminder_2h") {
    return "Recordatorio: tu cita en {{business}} es a las {{time}} para {{service}}.";
  }
  return "Recordatorio de cita en {{business}}: {{date}}, servicio {{service}}.";
}

export async function ensureRemindersForUpcomingAppointments() {
  const now = new Date();
  const maxDate = addMinutes(now, 48 * 60);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "confirmed",
      startsAt: { gt: now, lte: maxDate }
    },
    include: { business: true, customer: true }
  });

  let created = 0;
  for (const appointment of appointments) {
    for (const config of REMINDER_TYPES) {
      const scheduledAt = addMinutes(appointment.startsAt, -config.minutesBefore);
      if (scheduledAt <= addMinutes(now, -60)) continue;

      const existing = await prisma.reminder.findFirst({
        where: { appointmentId: appointment.id, type: config.type }
      });
      if (existing) continue;

      await prisma.reminder.create({
        data: {
          businessId: appointment.businessId,
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          type: config.type,
          channel: "whatsapp",
          scheduledAt,
          status: "pending",
          payload: JSON.stringify({ appointmentId: appointment.id })
        }
      });
      created += 1;
    }
  }

  return created;
}

export async function processDueReminders() {
  const now = new Date();
  const reminders = await prisma.reminder.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now }
    },
    include: {
      business: true,
      customer: true,
      appointment: { include: { business: true, customer: true } }
    },
    orderBy: { scheduledAt: "asc" },
    take: 20
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    if (!reminder.appointment || reminder.appointment.status !== "confirmed") {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "skipped", payload: JSON.stringify({ reason: "appointment_not_confirmed" }) }
      });
      continue;
    }

    const template = await getTemplate({ businessId: reminder.businessId, key: reminder.type });
    const body = renderTemplate(template, appointmentContext(reminder.appointment));

    try {
      const outbound = await sendWhatsappMessage({
        business: reminder.business,
        to: reminder.customer.phone,
        body
      });

      if (!outbound) {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: "queued_no_provider",
            payload: JSON.stringify({ body, reason: "whatsapp_provider_not_configured", provider: reminder.business.whatsappProvider })
          }
        });
        continue;
      }

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          payload: JSON.stringify({ body, provider: outbound.provider, messageId: outbound.id, status: outbound.status })
        }
      });
      sent += 1;
    } catch (error) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "failed",
          payload: JSON.stringify({
            body,
            error: error.message,
            code: error.code,
            status: error.status
          })
        }
      });
      failed += 1;
    }
  }

  return { processed: reminders.length, sent, failed };
}

export async function runReminderCycle() {
  const created = await ensureRemindersForUpcomingAppointments();
  const processed = await processDueReminders();
  return { created, ...processed };
}
