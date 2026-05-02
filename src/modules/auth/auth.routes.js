import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { createSessionToken, hashPassword, hashToken, verifyPassword } from "./password.js";
import { isInternalAdmin, requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2)
});

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientKey(req, email) {
  return `${req.ip || "unknown"}:${String(email || "").toLowerCase()}`;
}

function registerFailedLogin(req, email) {
  const key = clientKey(req, email);
  const now = Date.now();
  const current = loginAttempts.get(key);
  const attempt = current && current.resetAt > now
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + LOGIN_WINDOW_MS };
  loginAttempts.set(key, attempt);
}

function clearFailedLogin(req, email) {
  loginAttempts.delete(clientKey(req, email));
}

function isLoginBlocked(req, email) {
  const attempt = loginAttempts.get(clientKey(req, email));
  if (!attempt) return false;
  if (attempt.resetAt <= Date.now()) {
    loginAttempts.delete(clientKey(req, email));
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

async function issueSession(user) {
  const token = createSessionToken();
  await prisma.session.deleteMany({
    where: {
      OR: [
        { userId: user.id, expiresAt: { lte: new Date() } },
        { userId: user.id, createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45) } }
      ]
    }
  });
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });
  return token;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, isInternalAdmin: isInternalAdmin(user) };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
      return res.status(403).json({ error: "Public registration is disabled" });
    }
    const parsed = registerSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash: hashPassword(parsed.password)
      }
    });
    const token = await issueSession(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    if (isLoginBlocked(req, parsed.email)) {
      return res.status(429).json({ error: "Too many login attempts. Try again later." });
    }
    const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
    if (!user || !verifyPassword(parsed.password, user.passwordHash)) {
      registerFailedLogin(req, parsed.email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearFailedLogin(req, parsed.email);
    const token = await issueSession(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const token = req.headers.authorization.slice(7);
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  res.status(204).end();
});
