import { Router } from "express";
import { prisma } from "../../prisma.js";
import { requireAuth, requireInternalAdmin } from "../auth/auth.middleware.js";

export const internalRouter = Router();

internalRouter.use(requireAuth, requireInternalAdmin);

internalRouter.get("/overview", async (_req, res, next) => {
  try {
    const now = new Date();
    const [businesses, users, activeSessions, totalLeads, needsHuman, wonLeads, lostLeads, overdueFollowUps, recentBusinesses, recentLeads] =
      await Promise.all([
        prisma.business.count(),
        prisma.user.count(),
        prisma.session.count({ where: { expiresAt: { gt: now } } }),
        prisma.customer.count(),
        prisma.customer.count({ where: { needsHuman: true } }),
        prisma.customer.count({ where: { leadStatus: "ganado" } }),
        prisma.customer.count({ where: { leadStatus: "perdido" } }),
        prisma.customer.count({ where: { followUpAt: { lt: now } } }),
        prisma.business.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            _count: { select: { customers: true, conversations: true, appointments: true } },
            members: { include: { user: true }, take: 3 }
          }
        }),
        prisma.customer.findMany({
          orderBy: [{ needsHuman: "desc" }, { updatedAt: "desc" }],
          take: 12,
          include: {
            business: { select: { id: true, name: true, niche: true } },
            conversations: { orderBy: { createdAt: "desc" }, take: 1 }
          }
        })
      ]);

    res.json({
      totals: {
        businesses,
        users,
        activeSessions,
        totalLeads,
        needsHuman,
        wonLeads,
        lostLeads,
        overdueFollowUps
      },
      recentBusinesses: recentBusinesses.map((business) => ({
        id: business.id,
        name: business.name,
        niche: business.niche,
        automationType: business.automationType,
        createdAt: business.createdAt,
        customers: business._count.customers,
        conversations: business._count.conversations,
        appointments: business._count.appointments,
        owners: business.members.map((member) => ({
          name: member.user.name,
          email: member.user.email,
          role: member.role
        }))
      })),
      recentLeads
    });
  } catch (error) {
    next(error);
  }
});
