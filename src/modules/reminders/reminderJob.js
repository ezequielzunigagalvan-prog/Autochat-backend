import { runReminderCycle } from "./reminderService.js";

const INTERVAL_MS = 60 * 1000;

export function startReminderJob() {
  if (process.env.REMINDER_JOB_ENABLED === "false") return;

  async function tick() {
    try {
      const result = await runReminderCycle();
      if (result.created || result.processed) {
        console.log(`[reminders] created=${result.created} processed=${result.processed} sent=${result.sent} failed=${result.failed}`);
      }
    } catch (error) {
      console.error("[reminders] job failed:", error);
    }
  }

  setTimeout(tick, 5000);
  setInterval(tick, INTERVAL_MS);
}
