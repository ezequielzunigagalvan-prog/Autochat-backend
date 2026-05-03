import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { notifyLead } from "./leadNotifier.js";
import { ensureDemoBusiness, isDemoBusinessId } from "../demoBusinesses.js";

export const leadsRouter = Router();

const leadSchema = z.object({
  businessId: z.string().optional(),
  name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email().or(z.literal("")).optional().default(""),
  company: z.string().optional().default(""),
  address: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  previousFrom: z.string().optional().default(""),
  source: z.string().optional().default("widget_web")
});

async function loadBusiness(businessId) {
  if (isDemoBusinessId(businessId)) return ensureDemoBusiness(businessId);
  return businessId
    ? prisma.business.findUnique({ where: { id: businessId } })
    : prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
}

leadsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = leadSchema.parse(req.body);
    const business = await loadBusiness(parsed.businessId);
    if (!business) return res.status(400).json({ error: "No business configured" });
    const phoneKey = parsed.phone || parsed.email || parsed.previousFrom || `lead-${Date.now()}`;
    const contactNotes = [
      parsed.company ? `Empresa: ${parsed.company}` : "",
      parsed.address ? `Dirección: ${parsed.address}` : "",
      parsed.notes
    ].filter(Boolean).join("\n");

    const customer = await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: phoneKey
        }
      },
      update: {
        name: parsed.name || parsed.company || "Cliente sin nombre",
        email: parsed.email,
        company: parsed.company,
        contactAddress: parsed.address,
        notes: contactNotes,
        conversationState: "idle",
        pendingServiceId: null,
        pendingStartsAt: null,
        pendingData: "{}",
        botPaused: false,
        leadStatus: "nuevo",
        needsHuman: true,
        lastIntent: "lead_captured"
      },
      create: {
        businessId: business.id,
        name: parsed.name || parsed.company || "Cliente sin nombre",
        phone: phoneKey,
        email: parsed.email,
        company: parsed.company,
        contactAddress: parsed.address,
        notes: contactNotes,
        leadStatus: "nuevo",
        needsHuman: true,
        lastIntent: "lead_captured"
      }
    });

    if (parsed.previousFrom && parsed.previousFrom !== parsed.phone) {
      const previousCustomer = await prisma.customer.findUnique({
        where: {
          businessId_phone: {
            businessId: business.id,
            phone: parsed.previousFrom
          }
        }
      });

      await prisma.conversation.updateMany({
        where: { businessId: business.id, from: parsed.previousFrom },
        data: { customerId: customer.id, from: customer.phone }
      });

      if (previousCustomer && previousCustomer.id !== customer.id) {
        await prisma.appointment.updateMany({
          where: { customerId: previousCustomer.id },
          data: {
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone
          }
        });

        const mergedNotes = [previousCustomer.notes, customer.notes].filter(Boolean).join("\n\n");
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            notes: mergedNotes || customer.notes,
            leadStatus: previousCustomer.lastIntent === "quote_complete" ? "contactado" : customer.leadStatus,
            lastIntent: previousCustomer.lastIntent || customer.lastIntent,
            company: customer.company || previousCustomer.company,
            contactAddress: customer.contactAddress || previousCustomer.contactAddress,
            quoteService: customer.quoteService || previousCustomer.quoteService,
            quoteDetails: customer.quoteDetails || previousCustomer.quoteDetails,
            quoteLocation: customer.quoteLocation || previousCustomer.quoteLocation,
            quoteUrgency: customer.quoteUrgency || previousCustomer.quoteUrgency,
            needsHuman: true
          }
        });
        await prisma.customer.delete({ where: { id: previousCustomer.id } }).catch(() => {});
      }
    }

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
