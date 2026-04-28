import { Router } from "express";
import { prisma } from "../../prisma.js";
import { requireAuth, requireBusinessAccess } from "../auth/auth.middleware.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const businessIds = req.memberships.map((membership) => membership.businessId);
    const [
      businesses,
      totalLeads,
      newLeads,
      needsHuman,
      conversations,
      upcomingAppointments,
      recentLeads
    ] = await Promise.all([
      prisma.business.findMany({
        where: { id: { in: businessIds } },
        include: {
          _count: {
            select: {
              customers: true,
              conversations: true,
              appointments: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.customer.count({ where: { businessId: { in: businessIds } } }),
      prisma.customer.count({ where: { businessId: { in: businessIds }, leadStatus: "nuevo" } }),
      prisma.customer.count({ where: { businessId: { in: businessIds }, needsHuman: true } }),
      prisma.conversation.count({ where: { businessId: { in: businessIds } } }),
      prisma.appointment.count({
        where: { businessId: { in: businessIds }, status: "confirmed", startsAt: { gt: new Date() } }
      }),
      prisma.customer.findMany({
        where: { businessId: { in: businessIds } },
        include: {
          business: { select: { id: true, name: true, niche: true } },
          conversations: { orderBy: { createdAt: "desc" }, take: 1 }
        },
        orderBy: { updatedAt: "desc" },
        take: 12
      })
    ]);

    res.json({
      totals: {
        clients: businesses.length,
        totalLeads,
        newLeads,
        needsHuman,
        conversations,
        upcomingAppointments
      },
      clients: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        niche: business.niche,
        phone: business.phone,
        updatedAt: business.updatedAt,
        leads: business._count.customers,
        conversations: business._count.conversations,
        appointments: business._count.appointments
      })),
      recentLeads
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/:businessId", async (req, res, next) => {
  try {
    if (!requireBusinessAccess(req, res, req.params.businessId)) return;
    const businessId = req.params.businessId;
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const [
      appointmentsToday,
      upcomingAppointments,
      needsHuman,
      newLeads,
      activeCustomers,
      conversations,
      recentAppointments
    ] = await Promise.all([
      prisma.appointment.count({
        where: { businessId, status: "confirmed", startsAt: { gte: todayStart, lte: todayEnd } }
      }),
      prisma.appointment.count({
        where: { businessId, status: "confirmed", startsAt: { gt: new Date() } }
      }),
      prisma.customer.count({ where: { businessId, needsHuman: true } }),
      prisma.customer.count({ where: { businessId, leadStatus: "nuevo" } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.conversation.count({ where: { businessId } }),
      prisma.appointment.findMany({
        where: { businessId, status: "confirmed" },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);

    const serviceCounts = recentAppointments.reduce((acc, appointment) => {
      acc[appointment.serviceName] = (acc[appointment.serviceName] || 0) + 1;
      return acc;
    }, {});

    res.json({
      appointmentsToday,
      upcomingAppointments,
      needsHuman,
      newLeads,
      activeCustomers,
      conversations,
      topServices: Object.entries(serviceCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});
