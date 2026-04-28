import { prisma } from "../../prisma.js";

const ACTIVE_APPOINTMENT_STATUSES = ["confirmed", "hold"];
const SLOT_STEP_MINUTES = 30;
const SUGGESTION_WINDOW_MINUTES = 240;

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getAppointmentEnd(appointment) {
  return addMinutes(appointment.startsAt, appointment.service?.durationMinutes || 30);
}

function parseSchedule(scheduleText) {
  try {
    return JSON.parse(scheduleText || "{}");
  } catch {
    return {};
  }
}

function parseTimeForDate(date, time) {
  const [hour, minute] = String(time).split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0, 0, 0);
}

function getBusinessWindows(business, date) {
  const schedule = parseSchedule(business.weeklySchedule);
  const dayWindows = schedule[String(date.getDay())] || [];
  return dayWindows.map((window) => ({
    start: parseTimeForDate(date, window.start),
    end: parseTimeForDate(date, window.end)
  }));
}

function isInsideBusinessHours({ business, startsAt, endsAt }) {
  return getBusinessWindows(business, startsAt).some((window) => startsAt >= window.start && endsAt <= window.end);
}

function isPastDate(startsAt) {
  return startsAt <= new Date();
}

function exceedsBookingWindow({ business, startsAt }) {
  const max = addMinutes(new Date(), business.bookingWindowDays * 24 * 60);
  return startsAt > max;
}

async function clearExpiredHolds(businessId) {
  await prisma.appointment.updateMany({
    where: {
      businessId,
      status: "hold",
      holdExpiresAt: { lte: new Date() }
    },
    data: { status: "expired" }
  });
}

async function getDayContext({ businessId, date }) {
  await clearExpiredHolds(businessId);

  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startsAt: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      include: { service: true },
      orderBy: { startsAt: "asc" }
    }),
    prisma.availabilityBlock.findMany({
      where: {
        businessId,
        startsAt: { lte: endOfDay(date) },
        endsAt: { gte: startOfDay(date) }
      }
    })
  ]);

  return { appointments, blocks };
}

async function getEligibleStaff({ businessId, serviceId }) {
  const staff = await prisma.staff.findMany({
    where: {
      businessId,
      active: true,
      staffServices: { some: { serviceId } }
    },
    orderBy: { createdAt: "asc" }
  });

  if (staff.length) return staff;

  return prisma.staff.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: "asc" }
  });
}

function staffIsFree({ staffId, startsAt, endsAt, bufferMinutes, appointments, blocks }) {
  const bufferedStart = addMinutes(startsAt, -bufferMinutes);
  const bufferedEnd = addMinutes(endsAt, bufferMinutes);

  const hasBusinessBlock = blocks.some((block) =>
    !block.staffId && rangesOverlap(startsAt, endsAt, block.startsAt, block.endsAt)
  );
  if (hasBusinessBlock) return false;

  const hasStaffBlock = blocks.some((block) =>
    block.staffId === staffId && rangesOverlap(startsAt, endsAt, block.startsAt, block.endsAt)
  );
  if (hasStaffBlock) return false;

  return !appointments.some((appointment) => {
    if (appointment.staffId && appointment.staffId !== staffId) return false;
    const existingBuffer = appointment.service?.bufferMinutes ?? bufferMinutes;
    const existingStart = addMinutes(appointment.startsAt, -existingBuffer);
    const existingEnd = addMinutes(getAppointmentEnd(appointment), existingBuffer);
    return rangesOverlap(bufferedStart, bufferedEnd, existingStart, existingEnd);
  });
}

function firstRuleFailure({ business, startsAt, endsAt }) {
  if (isPastDate(startsAt)) return "past";
  if (exceedsBookingWindow({ business, startsAt })) return "booking_window";
  if (!isInsideBusinessHours({ business, startsAt, endsAt })) return "outside_hours";
  return null;
}

export async function checkAppointmentAvailability({ businessId, serviceId, startsAt }) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, active: true }
  });
  if (!business || !service) {
    throw Object.assign(new Error("Invalid business or service"), { status: 400 });
  }

  const requestedStart = new Date(startsAt);
  const requestedEnd = addMinutes(requestedStart, service.durationMinutes);
  const bufferMinutes = service.bufferMinutes ?? business.defaultBufferMinutes;
  const ruleFailure = firstRuleFailure({ business, startsAt: requestedStart, endsAt: requestedEnd });

  const eligibleStaff = await getEligibleStaff({ businessId, serviceId });
  if (!eligibleStaff.length) {
    return { available: false, business, service, reason: "no_staff", suggestions: [] };
  }

  const context = await getDayContext({ businessId, date: requestedStart });
  if (!ruleFailure) {
    const freeStaff = eligibleStaff.find((staff) =>
      staffIsFree({
        staffId: staff.id,
        startsAt: requestedStart,
        endsAt: requestedEnd,
        bufferMinutes,
        appointments: context.appointments,
        blocks: context.blocks
      })
    );

    if (freeStaff) {
      return { available: true, business, service, staff: freeStaff, suggestions: [] };
    }
  }

  const suggestions = await suggestNearbySlots({
    business,
    service,
    requestedStart,
    eligibleStaff,
    context
  });

  return {
    available: false,
    business,
    service,
    reason: ruleFailure || "conflict",
    suggestions
  };
}

export async function suggestNearbySlots({ business, service, requestedStart, eligibleStaff, context }) {
  const suggestions = [];
  const bufferMinutes = service.bufferMinutes ?? business.defaultBufferMinutes;
  const staff = eligibleStaff || (await getEligibleStaff({ businessId: business.id, serviceId: service.id }));
  const dayContext = context || (await getDayContext({ businessId: business.id, date: requestedStart }));

  for (let offset = 0; offset <= SUGGESTION_WINDOW_MINUTES; offset += SLOT_STEP_MINUTES) {
    for (const direction of offset === 0 ? [1] : [1, -1]) {
      const slotStart = addMinutes(requestedStart, offset * direction);
      if (slotStart.toDateString() !== requestedStart.toDateString()) continue;

      const slotEnd = addMinutes(slotStart, service.durationMinutes);
      if (firstRuleFailure({ business, startsAt: slotStart, endsAt: slotEnd })) continue;

      const freeStaff = staff.find((person) =>
        staffIsFree({
          staffId: person.id,
          startsAt: slotStart,
          endsAt: slotEnd,
          bufferMinutes,
          appointments: dayContext.appointments,
          blocks: dayContext.blocks
        })
      );

      if (freeStaff && !suggestions.some((item) => item.startsAt.getTime() === slotStart.getTime())) {
        suggestions.push({ startsAt: slotStart, staffId: freeStaff.id, staffName: freeStaff.name });
      }

      if (suggestions.length >= 3) return suggestions.sort((a, b) => a.startsAt - b.startsAt);
    }
  }

  return suggestions.sort((a, b) => a.startsAt - b.startsAt);
}

export function formatSlotSuggestions(suggestions) {
  if (!suggestions.length) {
    return "No encontré horarios cercanos libres ese mismo día. Puedes proponer otro día u otra hora.";
  }

  const formatted = suggestions.map((slot) =>
    slot.startsAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  );
  return `Te puedo ofrecer horarios cercanos: ${formatted.join(", ")}.`;
}

export function availabilityMessage(result) {
  const base = {
    past: "Ese horario ya pasó.",
    booking_window: `Solo puedo agendar dentro de los próximos ${result.business.bookingWindowDays} días.`,
    outside_hours: "Ese horario está fuera del horario de atención.",
    no_staff: "No hay personal configurado para ese servicio.",
    conflict: "Ese horario ya se encuentra apartado."
  };

  return `${base[result.reason] || base.conflict} ${formatSlotSuggestions(result.suggestions)}`;
}
