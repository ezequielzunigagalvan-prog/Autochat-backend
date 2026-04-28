ALTER TABLE "Business" ADD COLUMN "whatsappProvider" TEXT NOT NULL DEFAULT 'twilio';
ALTER TABLE "Business" ADD COLUMN "metaPhoneNumberId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Business" ADD COLUMN "metaAccessToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Business" ADD COLUMN "metaVerifyToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Business" ADD COLUMN "metaBusinessAccountId" TEXT NOT NULL DEFAULT '';
