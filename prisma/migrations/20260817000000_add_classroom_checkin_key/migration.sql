-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "checkinKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_checkinKey_key" ON "Classroom"("checkinKey");
