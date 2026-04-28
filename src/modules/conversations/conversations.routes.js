import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { answerMessage } from "../chat/chatEngine.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const conversationRouter = Router();

const messageSchema = z.object({
  businessId: z.string(),
  from: z.string().min(2),
  text: z.string().min(1)
});

conversationRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    if (req.query.businessId && !requireBusinessAccess(req, res, String(req.query.businessId))) return;
    const allowedBusinessIds = req.memberships.map((membership) => membership.businessId);
    const conversations = await prisma.conversation.findMany({
      where: req.query.businessId
        ? { businessId: String(req.query.businessId) }
        : { businessId: { in: allowedBusinessIds } },
      orderBy: { createdAt: "desc" }
    });
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

conversationRouter.post("/message", async (req, res, next) => {
  try {
    const parsed = messageSchema.parse(req.body);
    const result = await answerMessage(parsed);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
