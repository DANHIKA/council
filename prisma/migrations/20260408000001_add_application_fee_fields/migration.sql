-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('APPLICATION', 'PERMIT');

-- AlterTable: rename fee → applicationFee, add permitFee on PermitType
ALTER TABLE "PermitType" RENAME COLUMN "fee" TO "applicationFee";
ALTER TABLE "PermitType" ADD COLUMN "permitFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable: drop paymentStatus from PermitApplication (now derived from Payment records)
ALTER TABLE "PermitApplication" DROP COLUMN IF EXISTS "paymentStatus";

-- AlterTable: add type column to Payment
ALTER TABLE "Payment" ADD COLUMN "type" "PaymentType" NOT NULL DEFAULT 'APPLICATION';

-- DropIndex: old unique constraint on Payment(applicationId) alone
DROP INDEX IF EXISTS "Payment_applicationId_key";

-- CreateIndex: new composite unique on Payment(applicationId, type)
CREATE UNIQUE INDEX "Payment_applicationId_type_key" ON "Payment"("applicationId", "type");

-- AlterTable: add supabaseId to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supabaseId" TEXT;

-- CreateIndex: unique on User(supabaseId)
CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseId_key" ON "User"("supabaseId");
