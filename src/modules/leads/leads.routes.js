import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { notifyLead } from "./leadNotifier.js";

export const leadsRouter = Router();

const leadSchema = z.object({
  businessId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().or(z.literal("")).optional().default(""),
  notes: z.string().optional().default(""),
  source: z.string().optional().default("widget_web")
});

async function loadBusiness(businessId) {
  return businessId
    ? prisma.business.findUnique({ where: { id: businessId } })
    : prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
}

leadsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = leadSchema.parse(req.body);
    const business = await loadBusiness(parsed.businessId);
    if (!business) return res.status(400).json({ error: "No business configured" });

    const customer = await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: parsed.phone
        }
      },
      update: {
        name: parsed.name,
        email: parsed.email,
        notes: parsed.notes,
        leadStatus: "nuevo",
        needsHuman: true,
        lastIntent: "lead_captured"
      },
      create: {
        businessId: business.id,
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        notes: parsed.notes,
        leadStatus: "nuevo",
        needsHuman: true,
        lastIntent: "lead_captured"
      }
    });

    await notifyLead({ business, customer, source: parsed.source }).catch((error) => {
      console.warn("Lead notification failed:", error.message);
    });

    res.status(201).json({
      businessId: business.id,
      customerId: customer.id,
      from: customer.phone,
      message: "Lead capturado."
    });
  } catch (error) {
    next(error);
  }
});
