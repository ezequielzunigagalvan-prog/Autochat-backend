import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { createSessionToken, hashPassword, hashToken, verifyPassword } from "./password.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2)
});

async function issueSession(user) {
  const token = createSessionToken();
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
  return { id: user.id, name: user.name, email: user.email };
}

authRouter.post("/register", async (req, res, next) => {
  try {
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
    const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
    if (!user || !verifyPassword(parsed.password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

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
