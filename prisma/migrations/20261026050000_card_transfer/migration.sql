-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "transferredToId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "StudentCard_transferredToId_key" ON "StudentCard"("transferredToId");

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_transferredToId_fkey" FOREIGN KEY ("transferredToId") REFERENCES "StudentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

