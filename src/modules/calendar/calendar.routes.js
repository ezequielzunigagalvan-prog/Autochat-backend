import { Router } from "express";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

calendarRouter.get("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const weekStart = startOfWeek(req.query.start ? new Date(String(req.query.start)) : new Date());
    const weekEnd = addDays(weekStart, 7);

    const [business, appointments, blocks] = await Promise.all([
      prisma.business.findUnique({ where: { id: req.params.businessId } }),
      prisma.appointment.findMany({
        where: {
          businessId: req.params.businessId,
          status: { in: ["confirmed", "hold"] },
          startsAt: { gte: weekStart, lt: weekEnd }
        },
        include: { service: true, staff: true, customer: true },
        orderBy: { startsAt: "asc" }
      }),
      prisma.availabilityBlock.findMany({
        where: {
          businessId: req.params.businessId,
          startsAt: { lt: weekEnd },
          endsAt: { gte: weekStart }
        },
        include: { staff: true },
        orderBy: { startsAt: "asc" }
      })
    ]);

    res.json({
      weekStart,
      weekEnd,
      business,
      appointments,
      blocks
    });
  } catch (error) {
    next(error);
  }
});
