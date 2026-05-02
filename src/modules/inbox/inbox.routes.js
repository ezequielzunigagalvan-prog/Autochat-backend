import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const inboxRouter = Router();
inboxRouter.use(requireAuth);

const manualReplySchema = z.object({
  text: z.string().min(1)
});

const leadStatuses = ["nuevo", "contactado", "cita_agendada", "ganado", "perdido"];

const leadUpdateSchema = z.object({
  leadStatus: z.enum(leadStatuses).optional(),
  notes: z.string().optional(),
  needsHuman: z.boolean().optional(),
  nextAction: z.string().optional(),
  followUpAt: z.string().datetime().or(z.literal("")).nullable().optional(),
  assignedTo: z.string().optional()
});

inboxRouter.get("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const status = String(req.query.status || "");
    const statusFilter = leadStatuses.includes(status)
      ? { leadStatus: status }
      : {};
    const customers = await prisma.customer.findMany({
      where: { businessId: req.params.businessId, ...statusFilter },
      include: {
        conversations: { orderBy: { createdAt: "desc" }, take: 50 },
        appointments: { orderBy: { startsAt: "desc" }, take: 3 }
      },
      orderBy: [{ needsHuman: "desc" }, { updatedAt: "desc" }]
    });
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

inboxRouter.patch("/:businessId/customers/:customerId/lead", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const parsed = leadUpdateSchema.parse(req.body);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, businessId: req.params.businessId }
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        leadStatus: parsed.leadStatus,
        notes: parsed.notes,
        needsHuman: parsed.needsHuman,
        nextAction: parsed.nextAction,
        followUpAt: parsed.followUpAt === "" || parsed.followUpAt === null
          ? null
          : parsed.followUpAt
            ? new Date(parsed.followUpAt)
            : undefined,
        assignedTo: parsed.assignedTo
      },
      include: {
        conversations: { orderBy: { createdAt: "desc" }, take: 50 },
        appointments: { orderBy: { startsAt: "desc" }, take: 3 }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

inboxRouter.patch("/:businessId/customers/:customerId/bot", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, businessId: req.params.businessId }
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        botPaused: !customer.botPaused,
        needsHuman: customer.botPaused ? false : true
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

inboxRouter.post("/:businessId/customers/:customerId/reply", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const parsed = manualReplySchema.parse(req.body);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, businessId: req.params.businessId }
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const conversation = await prisma.conversation.create({
      data: {
        businessId: req.params.businessId,
        customerId: customer.id,
        channel: "panel",
        from: "agent",
        inboundText: "",
        outboundText: parsed.text,
        status: "manual_reply",
        direction: "outbound",
        handledBy: "human"
      }
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { needsHuman: false, botPaused: true, leadStatus: "contactado" }
    });

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});
