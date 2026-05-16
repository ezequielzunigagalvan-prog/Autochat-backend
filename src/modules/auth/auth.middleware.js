import { prisma } from "../../prisma.js";
import { hashToken } from "./password.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { memberships: true } } }
    });

    if (!session || session.expiresAt <= new Date()) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.user = session.user;
    req.memberships = session.user.memberships;
    next();
  } catch (error) {
    next(error);
  }
}

export function canAccessBusiness(req, businessId) {
  if (isInternalAdmin(req.user)) return true;
  return req.memberships?.some((membership) => membership.businessId === businessId);
}

export function getAccessibleBusinessIds(req) {
  return req.memberships?.map((membership) => membership.businessId) || [];
}

export function businessListWhere(req) {
  if (isInternalAdmin(req.user)) return {};
  return { id: { in: getAccessibleBusinessIds(req) } };
}

export function businessScopedWhere(req) {
  if (isInternalAdmin(req.user)) return {};
  return { businessId: { in: getAccessibleBusinessIds(req) } };
}

export function isInternalAdmin(user) {
  const adminEmails = String(process.env.INTERNAL_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user?.isInternalAdmin || adminEmails.includes(String(user?.email || "").toLowerCase()));
}

export function requireInternalAdmin(req, res, next) {
  if (!isInternalAdmin(req.user)) {
    return res.status(403).json({ error: "Internal admin access required" });
  }
  next();
}

export function requireBusinessAccess(req, res, businessId) {
  if (!canAccessBusiness(req, businessId)) {
    res.status(403).json({ error: "Business access denied" });
    return false;
  }
  return true;
}
