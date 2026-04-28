import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

const templateSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  body: z.string().min(2),
  active: z.boolean().optional().default(true)
});

templatesRouter.get("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const templates = await prisma.messageTemplate.findMany({
      where: { businessId: req.params.businessId },
      orderBy: { createdAt: "asc" }
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

templatesRouter.post("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const parsed = templateSchema.parse(req.body);
    const template = await prisma.messageTemplate.upsert({
      where: { businessId_key: { businessId: req.params.businessId, key: parsed.key } },
      update: parsed,
      create: { businessId: req.params.businessId, ...parsed }
    });
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

templatesRouter.put("/:businessId/:templateId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const parsed = templateSchema.partial().parse(req.body);
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.templateId, businessId: req.params.businessId }
    });
    if (!existing) return res.status(404).json({ error: "Template not found" });
    const template = await prisma.messageTemplate.update({
      where: { id: existing.id },
      data: parsed
    });
    res.json(template);
  } catch (error) {
    next(error);
  }
});
