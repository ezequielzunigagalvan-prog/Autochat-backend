import express from "express";
import cors from "cors";
import { businessRouter } from "./modules/businesses/businesses.routes.js";
import { appointmentRouter } from "./modules/appointments/appointments.routes.js";
import { conversationRouter } from "./modules/conversations/conversations.routes.js";
import { whatsappRouter } from "./modules/whatsapp/whatsapp.routes.js";
import { twilioWhatsappRouter } from "./modules/twilio/twilioWhatsapp.routes.js";
import { metaWhatsappRouter } from "./modules/meta/metaWhatsapp.routes.js";
import { dialog360WhatsappRouter } from "./modules/dialog360/dialog360Whatsapp.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { inboxRouter } from "./modules/inbox/inbox.routes.js";
import { templatesRouter } from "./modules/templates/templates.routes.js";
import { remindersRouter } from "./modules/reminders/reminders.routes.js";
import { calendarRouter } from "./modules/calendar/calendar.routes.js";
import { leadsRouter } from "./modules/leads/leads.routes.js";
import { publicRouter } from "./modules/public/public.routes.js";
import { internalRouter } from "./modules/internal/internal.routes.js";

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4000",
  "https://autochatmx.com",
  "https://www.autochatmx.com",
  "https://panel.autochatmx.com",
  "https://hidrolub.com",
  "https://www.hidrolub.com",
  "https://lubriplan.com",
  "https://www.lubriplan.com"
];

function getAllowedOrigins() {
  const configured = [
    process.env.FRONTEND_ORIGIN,
    process.env.PUBLIC_APP_URL,
    process.env.ADMIN_URL,
    process.env.CORS_ORIGINS
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([...defaultAllowedOrigins, ...configured]);
}

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname.includes("lubriplan")) return callback(null, true);
  } catch {
    // Fall back to explicit origin comparison below.
  }
  const allowedOrigins = getAllowedOrigins();
  return callback(null, allowedOrigins.has(origin.replace(/\/$/, "")));
}

export function createApp() {
  const app = express();

  app.use(cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/public", express.static("public", {
    etag: false,
    maxAge: 0,
    setHeaders(res, path) {
      if (path.endsWith("widget.js")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      }
    }
  }));
  app.use(express.static("public"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "autochat-backend" });
  });

  app.get("/", (_req, res) => {
    res.redirect("/public/landing.html");
  });

  app.get("/admin", (_req, res) => {
    const adminUrl = process.env.ADMIN_URL || (process.env.FRONTEND_ORIGIN ? `${process.env.FRONTEND_ORIGIN.replace(/\/$/, "")}/#admin` : "");
    if (adminUrl) return res.redirect(adminUrl);
    return res.redirect("/public/landing.html");
  });

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/inbox", inboxRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/reminders", remindersRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/internal", internalRouter);
  app.use("/api/businesses", businessRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/conversations", conversationRouter);
  app.use("/api/ai", aiRouter);
  app.use("/webhooks/whatsapp", whatsappRouter);
  app.use("/webhooks/twilio/whatsapp", twilioWhatsappRouter);
  app.use("/webhooks/meta/whatsapp", metaWhatsappRouter);
  app.use("/webhooks/360dialog/whatsapp", dialog360WhatsappRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Unexpected error" });
  });

  return app;
}
