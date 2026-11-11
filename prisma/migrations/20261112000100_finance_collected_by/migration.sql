-- AlterTable
ALTER TABLE "DropInCharge" ADD COLUMN     "collectedByUserId" INTEGER;

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "collectedByUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropInCharge" ADD CONSTRAINT "DropInCharge_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
