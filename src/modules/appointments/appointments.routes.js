import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { addMinutes, availabilityMessage, checkAppointmentAvailability } from "./availability.js";
import { businessScopedWhere, requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const appointmentRouter = Router();
appointmentRouter.use(requireAuth);

const appointmentSchema = z.object({
  businessId: z.string(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(6),
  serviceId: z.string(),
  startsAt: z.string(),
  status: z.enum(["confirmed", "hold"]).optional().default("confirmed"),
  notes: z.string().optional().default("")
});

const changeStatusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
  startsAt: z.string().optional(),
  serviceId: z.string().optional()
});

appointmentRouter.get("/", async (req, res, next) => {
  try {
    const businessId = req.query.businessId ? String(req.query.businessId) : undefined;
    if (businessId && !requireBusinessAccess(req, res, businessId)) return;
    const appointments = await prisma.appointment.findMany({
      where: businessId ? { businessId } : businessScopedWhere(req),
      orderBy: { startsAt: "asc" }
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
});

appointmentRouter.post("/", async (req, res, next) => {
  try {
    const parsed = appointmentSchema.parse(req.body);
    if (!requireBusinessAccess(req, res, parsed.businessId)) return;
    const service = await prisma.service.findFirst({
      where: { id: parsed.serviceId, businessId: parsed.businessId, active: true },
      include: { business: true }
    });
    if (!service) return res.status(400).json({ error: "Invalid business or service" });

    const startsAt = new Date(parsed.startsAt);
    const availability = await checkAppointmentAvailability({
      businessId: parsed.businessId,
      serviceId: parsed.serviceId,
      startsAt
    });
    if (!availability.available) {
      return res.status(409).json({
        error: "Appointment slot is not available",
        reason: availability.reason,
        message: availabilityMessage(availability),
        suggestions: availability.suggestions
      });
    }

    const customer = await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: parsed.businessId,
          phone: parsed.customerPhone
        }
      },
      update: { name: parsed.customerName },
      create: {
        businessId: parsed.businessId,
        name: parsed.customerName,
        phone: parsed.customerPhone
      }
    });

    const appointment = await prisma.appointment.create({
      data: {
        businessId: parsed.businessId,
        customerId: customer.id,
        serviceId: service.id,
        staffId: availability.staff?.id || null,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName: service.name,
        startsAt,
        status: parsed.status,
        holdExpiresAt: parsed.status === "hold" ? addMinutes(new Date(), availability.business.holdMinutes) : null,
        notes: parsed.notes
      }
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
});

appointmentRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const parsed = changeStatusSchema.parse(req.body);
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { business: true }
    });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (!requireBusinessAccess(req, res, appointment.businessId)) return;

    const hoursUntilAppointment = (appointment.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (parsed.status === "cancelled" && hoursUntilAppointment < appointment.business.cancellationMinHours) {
      return res.status(409).json({
        error: "Cancellation window closed",
        message: `Solo se puede cancelar con al menos ${appointment.business.cancellationMinHours} horas de anticipación.`
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: parsed.status, holdExpiresAt: null }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

appointmentRouter.patch("/:id/reschedule", async (req, res, next) => {
  try {
    const parsed = changeStatusSchema.pick({ startsAt: true, serviceId: true }).required({ startsAt: true }).parse(req.body);
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { business: true }
    });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (!requireBusinessAccess(req, res, appointment.businessId)) return;

    const hoursUntilAppointment = (appointment.startsAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilAppointment < appointment.business.cancellationMinHours) {
      return res.status(409).json({
        error: "Reschedule window closed",
        message: `Solo se puede reagendar con al menos ${appointment.business.cancellationMinHours} horas de anticipación.`
      });
    }

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "rescheduling" } });
    const availability = await checkAppointmentAvailability({
      businessId: appointment.businessId,
      serviceId: parsed.serviceId || appointment.serviceId,
      startsAt: new Date(parsed.startsAt)
    });

    if (!availability.available) {
      await prisma.appointment.update({ where: { id: appointment.id }, data: { status: appointment.status } });
      return res.status(409).json({
        error: "Appointment slot is not available",
        reason: availability.reason,
        message: availabilityMessage(availability),
        suggestions: availability.suggestions
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "confirmed",
        serviceId: availability.service.id,
        serviceName: availability.service.name,
        staffId: availability.staff?.id || null,
        startsAt: new Date(parsed.startsAt),
        holdExpiresAt: null
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});
