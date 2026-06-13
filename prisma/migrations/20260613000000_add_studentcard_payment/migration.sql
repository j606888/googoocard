-- CreateEnum
CREATE TYPE "CardPurchaseSource" AS ENUM ('STAFF', 'STUDENT');

-- AlterTable
ALTER TABLE "StudentCard"
ADD COLUMN "purchaseSource" "CardPurchaseSource" NOT NULL DEFAULT 'STAFF',
ADD COLUMN "purchasedByUserId" INTEGER,
ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paidByUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_purchasedByUserId_fkey" FOREIGN KEY ("purchasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
