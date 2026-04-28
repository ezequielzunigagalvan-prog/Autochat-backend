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

export function createApp() {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/public", express.static("public"));
  app.use(express.static("public"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "autochat-backend" });
  });

  app.get("/", (_req, res) => {
    res.redirect("/public/landing.html");
  });

  app.get("/admin", (_req, res) => {
    const adminUrl = process.env.ADMIN_URL || process.env.FRONTEND_ORIGIN;
    if (adminUrl) return res.redirect(`${adminUrl.replace(/\/$/, "")}/admin`);
    return res.redirect("/public/landing.html");
  });

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/inbox", inboxRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/reminders", remindersRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/leads", leadsRouter);
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
