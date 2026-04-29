import { Router } from "express";
import { z } from "zod";
import { businessTemplates } from "../../config/businessTemplates.js";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const businessRouter = Router();
businessRouter.use(requireAuth);

const businessSchema = z.object({
  name: z.string().min(2),
  niche: z.enum(["barberia", "estetica", "clinica_dental", "industrial", "servicios", "proyectos", "salud", "inmobiliaria", "educacion"]),
  automationType: z.enum(["appointment", "quote", "lead", "hybrid"]).optional().default("appointment"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  hours: z.string().optional().default(""),
  tone: z.string().optional().default("amable y profesional"),
  widgetTitle: z.string().optional().default("Asistente"),
  widgetIntro: z.string().optional().default("Deja tus datos para responderte y dar seguimiento a tu solicitud."),
  widgetInitialMessage: z.string().optional().default(""),
  widgetPrompt: z.string().optional().default("Quiero información sobre sus servicios"),
  whatsappSender: z.string().optional().default(""),
  whatsappProvider: z.enum(["none", "twilio", "meta", "360dialog"]).optional().default("none"),
  metaPhoneNumberId: z.string().optional().default(""),
  metaAccessToken: z.string().optional().default(""),
  metaVerifyToken: z.string().optional().default(""),
  metaBusinessAccountId: z.string().optional().default(""),
  dialog360ApiKey: z.string().optional().default(""),
  dialog360ChannelId: z.string().optional().default(""),
  timezone: z.string().optional(),
  weeklySchedule: z.string().optional(),
  bookingWindowDays: z.coerce.number().int().positive().optional(),
  cancellationMinHours: z.coerce.number().int().nonnegative().optional(),
  defaultBufferMinutes: z.coerce.number().int().nonnegative().optional(),
  holdMinutes: z.coerce.number().int().positive().optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional().default([]),
  services: z.array(z.object({
    name: z.string(),
    durationMinutes: z.coerce.number().int().positive(),
    bufferMinutes: z.coerce.number().int().nonnegative().optional(),
    price: z.coerce.number().int().nonnegative().optional().default(0)
  })).optional().default([])
});

const businessUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  niche: z.enum(["barberia", "estetica", "clinica_dental", "industrial", "servicios", "proyectos", "salud", "inmobiliaria", "educacion"]).optional(),
  automationType: z.enum(["appointment", "quote", "lead", "hybrid"]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  tone: z.string().optional(),
  widgetTitle: z.string().optional(),
  widgetIntro: z.string().optional(),
  widgetInitialMessage: z.string().optional(),
  widgetPrompt: z.string().optional(),
  whatsappSender: z.string().optional(),
  whatsappProvider: z.enum(["none", "twilio", "meta", "360dialog"]).optional(),
  metaPhoneNumberId: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaVerifyToken: z.string().optional(),
  metaBusinessAccountId: z.string().optional(),
  dialog360ApiKey: z.string().optional(),
  dialog360ChannelId: z.string().optional(),
  timezone: z.string().optional(),
  weeklySchedule: z.string().optional(),
  bookingWindowDays: z.coerce.number().int().positive().optional(),
  cancellationMinHours: z.coerce.number().int().nonnegative().optional(),
  defaultBufferMinutes: z.coerce.number().int().nonnegative().optional(),
  holdMinutes: z.coerce.number().int().positive().optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  services: z.array(z.object({
    name: z.string(),
    durationMinutes: z.coerce.number().int().positive(),
    bufferMinutes: z.coerce.number().int().nonnegative().optional(),
    price: z.coerce.number().int().nonnegative().optional().default(0)
  })).optional()
});

const staffSchema = z.object({
  name: z.string().min(2),
  active: z.boolean().optional().default(true),
  serviceIds: z.array(z.string()).optional().default([])
});

const serviceSchema = z.object({
  name: z.string().min(2),
  durationMinutes: z.coerce.number().int().positive(),
  price: z.coerce.number().int().nonnegative().default(0),
  bufferMinutes: z.coerce.number().int().nonnegative().optional(),
  active: z.boolean().optional().default(true)
});

const faqSchema = z.object({
  question: z.string().min(2),
  answer: z.string().min(2),
  active: z.boolean().optional().default(true)
});

const customerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  notes: z.string().optional(),
  leadStatus: z.enum(["nuevo", "contactado", "cita_agendada", "perdido"]).optional()
});

const blockSchema = z.object({
  staffId: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string().optional().default(""),
  type: z.string().optional().default("manual_block")
});

const includeBusinessRelations = {
  services: { orderBy: { createdAt: "asc" } },
  faqs: { orderBy: { createdAt: "asc" } }
};

function normalizeServices(services) {
  return services.map((service) => ({
    name: service.name,
    durationMinutes: service.durationMinutes,
    price: service.price ?? 0,
    bufferMinutes: service.bufferMinutes ?? 10
  }));
}

businessRouter.get("/", async (req, res, next) => {
  try {
    const businessIds = req.memberships.map((membership) => membership.businessId);
    const businesses = await prisma.business.findMany({
      where: { id: { in: businessIds } },
      include: includeBusinessRelations,
      orderBy: { createdAt: "asc" }
    });
    res.json(businesses);
  } catch (error) {
    next(error);
  }
});

businessRouter.get("/:id", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: includeBusinessRelations
    });
    if (!business) return res.status(404).json({ error: "Business not found" });
    res.json(business);
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/", async (req, res, next) => {
  try {
    const parsed = businessSchema.parse(req.body);
    const template = businessTemplates[parsed.niche];
    const servicesToCreate = parsed.services.length ? parsed.services : (template?.services || []);
    const faqsToCreate = parsed.faqs.length ? parsed.faqs : (template?.faqs || []);
    const automationType = req.body.automationType || template?.automationType || parsed.automationType || "appointment";

    const business = await prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          name: parsed.name,
          niche: parsed.niche,
          automationType,
          phone: parsed.phone,
          address: parsed.address,
          hours: parsed.hours,
          tone: parsed.tone,
          widgetTitle: parsed.widgetTitle,
          widgetIntro: parsed.widgetIntro,
          widgetInitialMessage: parsed.widgetInitialMessage,
          widgetPrompt: parsed.widgetPrompt,
          whatsappSender: parsed.whatsappSender,
          whatsappProvider: parsed.whatsappProvider,
          metaPhoneNumberId: parsed.metaPhoneNumberId,
          metaAccessToken: parsed.metaAccessToken,
          metaVerifyToken: parsed.metaVerifyToken,
          metaBusinessAccountId: parsed.metaBusinessAccountId,
          dialog360ApiKey: parsed.dialog360ApiKey,
          dialog360ChannelId: parsed.dialog360ChannelId,
          timezone: parsed.timezone,
          weeklySchedule: parsed.weeklySchedule,
          bookingWindowDays: parsed.bookingWindowDays,
          cancellationMinHours: parsed.cancellationMinHours,
          defaultBufferMinutes: parsed.defaultBufferMinutes,
          holdMinutes: parsed.holdMinutes,
          faqs: { create: faqsToCreate },
          services: { create: normalizeServices(servicesToCreate) }
        },
        include: includeBusinessRelations
      });
      await tx.businessMember.create({
        data: { businessId: created.id, userId: req.user.id, role: "owner" }
      });
      return created;
    });
    res.status(201).json(business);
  } catch (error) {
    next(error);
  }
});

businessRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = businessUpdateSchema.parse(req.body);
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const current = await prisma.business.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Business not found" });

    const business = await prisma.$transaction(async (tx) => {
      if (parsed.services) {
        await tx.service.deleteMany({ where: { businessId: req.params.id } });
      }
      if (parsed.faqs) {
        await tx.faq.deleteMany({ where: { businessId: req.params.id } });
      }

      return tx.business.update({
        where: { id: req.params.id },
        data: {
          name: parsed.name,
          niche: parsed.niche,
          automationType: parsed.automationType,
          phone: parsed.phone,
          address: parsed.address,
          hours: parsed.hours,
          tone: parsed.tone,
          widgetTitle: parsed.widgetTitle,
          widgetIntro: parsed.widgetIntro,
          widgetInitialMessage: parsed.widgetInitialMessage,
          widgetPrompt: parsed.widgetPrompt,
          whatsappSender: parsed.whatsappSender,
          whatsappProvider: parsed.whatsappProvider,
          metaPhoneNumberId: parsed.metaPhoneNumberId,
          metaAccessToken: parsed.metaAccessToken,
          metaVerifyToken: parsed.metaVerifyToken,
          metaBusinessAccountId: parsed.metaBusinessAccountId,
          dialog360ApiKey: parsed.dialog360ApiKey,
          dialog360ChannelId: parsed.dialog360ChannelId,
          timezone: parsed.timezone,
          weeklySchedule: parsed.weeklySchedule,
          bookingWindowDays: parsed.bookingWindowDays,
          cancellationMinHours: parsed.cancellationMinHours,
          defaultBufferMinutes: parsed.defaultBufferMinutes,
          holdMinutes: parsed.holdMinutes,
          services: parsed.services ? { create: parsed.services } : undefined,
          faqs: parsed.faqs ? { create: parsed.faqs } : undefined
        },
        include: includeBusinessRelations
      });
    });

    res.json(business);
  } catch (error) {
    next(error);
  }
});

businessRouter.get("/:id/staff", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const staff = await prisma.staff.findMany({
      where: { businessId: req.params.id },
      include: { staffServices: { include: { service: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json(staff);
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/:id/staff", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = staffSchema.parse(req.body);
    const staff = await prisma.staff.create({
      data: {
        businessId: req.params.id,
        name: parsed.name,
        active: parsed.active,
        staffServices: { create: parsed.serviceIds.map((serviceId) => ({ serviceId })) }
      },
      include: { staffServices: { include: { service: true } } }
    });
    res.status(201).json(staff);
  } catch (error) {
    next(error);
  }
});

businessRouter.put("/:id/staff/:staffId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = staffSchema.partial().parse(req.body);
    const existing = await prisma.staff.findFirst({ where: { id: req.params.staffId, businessId: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    const staff = await prisma.$transaction(async (tx) => {
      if (parsed.serviceIds) {
        await tx.staffService.deleteMany({ where: { staffId: req.params.staffId } });
      }
      return tx.staff.update({
        where: { id: req.params.staffId },
        data: {
          name: parsed.name,
          active: parsed.active,
          staffServices: parsed.serviceIds ? { create: parsed.serviceIds.map((serviceId) => ({ serviceId })) } : undefined
        },
        include: { staffServices: { include: { service: true } } }
      });
    });

    res.json(staff);
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/:id/services", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = serviceSchema.parse(req.body);
    const service = await prisma.service.create({
      data: { businessId: req.params.id, ...parsed }
    });
    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
});

businessRouter.put("/:id/services/:serviceId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = serviceSchema.partial().parse(req.body);
    const existing = await prisma.service.findFirst({
      where: { id: req.params.serviceId, businessId: req.params.id }
    });
    if (!existing) return res.status(404).json({ error: "Service not found" });

    const service = await prisma.service.update({
      where: { id: existing.id },
      data: parsed
    });
    res.json(service);
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/:id/faqs", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = faqSchema.parse(req.body);
    const faq = await prisma.faq.create({
      data: { businessId: req.params.id, ...parsed }
    });
    res.status(201).json(faq);
  } catch (error) {
    next(error);
  }
});

businessRouter.put("/:id/faqs/:faqId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = faqSchema.partial().parse(req.body);
    const existing = await prisma.faq.findFirst({
      where: { id: req.params.faqId, businessId: req.params.id }
    });
    if (!existing) return res.status(404).json({ error: "FAQ not found" });

    const faq = await prisma.faq.update({
      where: { id: existing.id },
      data: parsed
    });
    res.json(faq);
  } catch (error) {
    next(error);
  }
});

businessRouter.get("/:id/customers", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const customers = await prisma.customer.findMany({
      where: { businessId: req.params.id },
      include: {
        appointments: { orderBy: { startsAt: "desc" }, take: 5 },
        conversations: { orderBy: { createdAt: "desc" }, take: 5 }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

businessRouter.put("/:id/customers/:customerId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = customerUpdateSchema.parse(req.body);
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.customerId, businessId: req.params.id }
    });
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    const customer = await prisma.customer.update({
      where: { id: existing.id },
      data: parsed
    });
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

businessRouter.get("/:id/blocks", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const blocks = await prisma.availabilityBlock.findMany({
      where: { businessId: req.params.id },
      orderBy: { startsAt: "asc" }
    });
    res.json(blocks);
  } catch (error) {
    next(error);
  }
});

businessRouter.post("/:id/blocks", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const parsed = blockSchema.parse(req.body);
    const block = await prisma.availabilityBlock.create({
      data: {
        businessId: req.params.id,
        staffId: parsed.staffId,
        startsAt: new Date(parsed.startsAt),
        endsAt: new Date(parsed.endsAt),
        reason: parsed.reason,
        type: parsed.type
      }
    });
    res.status(201).json(block);
  } catch (error) {
    next(error);
  }
});

businessRouter.delete("/:id/blocks/:blockId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.id)) return;
    const block = await prisma.availabilityBlock.findFirst({
      where: { id: req.params.blockId, businessId: req.params.id }
    });
    if (!block) return res.status(404).json({ error: "Block not found" });

    await prisma.availabilityBlock.delete({ where: { id: block.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
