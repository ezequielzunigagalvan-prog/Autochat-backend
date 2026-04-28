import dotenv from "dotenv";
import { createApp } from "./app.js";
import { startReminderJob } from "./modules/reminders/reminderJob.js";

dotenv.config();

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`AutoChat backend listening on http://localhost:${port}`);
  startReminderJob();
});
