import { Router } from "express";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";
import { runReminderCycle } from "./reminderService.js";

export const remindersRouter = Router();
remindersRouter.use(requireAuth);

remindersRouter.get("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const reminders = await prisma.reminder.findMany({
      where: { businessId: req.params.businessId },
      include: {
        customer: true,
        appointment: true
      },
      orderBy: { scheduledAt: "desc" },
      take: 100
    });
    res.json(reminders);
  } catch (error) {
    next(error);
  }
});

remindersRouter.post("/run", async (_req, res, next) => {
  try {
    const result = await runReminderCycle();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
