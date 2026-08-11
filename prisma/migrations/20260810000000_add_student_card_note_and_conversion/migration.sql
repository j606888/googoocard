-- CreateEnum
CREATE TYPE "StudentCardOrigin" AS ENUM ('PURCHASE', 'CONVERSION');

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "convertedToId" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "origin" "StudentCardOrigin" NOT NULL DEFAULT 'PURCHASE';

-- CreateIndex
CREATE INDEX "StudentCard_convertedToId_idx" ON "StudentCard"("convertedToId");

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_convertedToId_fkey" FOREIGN KEY ("convertedToId") REFERENCES "StudentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
