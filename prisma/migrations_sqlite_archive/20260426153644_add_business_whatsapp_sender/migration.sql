-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT 'amable y profesional',
    "whatsappSender" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "weeklySchedule" TEXT NOT NULL DEFAULT '{"1":[{"start":"10:00","end":"20:00"}],"2":[{"start":"10:00","end":"20:00"}],"3":[{"start":"10:00","end":"20:00"}],"4":[{"start":"10:00","end":"20:00"}],"5":[{"start":"10:00","end":"20:00"}],"6":[{"start":"10:00","end":"20:00"}],"0":[]}',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 60,
    "cancellationMinHours" INTEGER NOT NULL DEFAULT 2,
    "defaultBufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "holdMinutes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("address", "bookingWindowDays", "cancellationMinHours", "createdAt", "defaultBufferMinutes", "holdMinutes", "hours", "id", "name", "niche", "phone", "timezone", "tone", "updatedAt", "weeklySchedule") SELECT "address", "bookingWindowDays", "cancellationMinHours", "createdAt", "defaultBufferMinutes", "holdMinutes", "hours", "id", "name", "niche", "phone", "timezone", "tone", "updatedAt", "weeklySchedule" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
