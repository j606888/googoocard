-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "isTrial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "lineInviteSentAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" INTEGER;

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentReference" TEXT;
