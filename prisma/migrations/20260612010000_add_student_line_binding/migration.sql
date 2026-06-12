-- AlterTable
ALTER TABLE "Student" ADD COLUMN "lineBindKey" TEXT,
ADD COLUMN "lineUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_lineBindKey_key" ON "Student"("lineBindKey");

-- CreateIndex
CREATE UNIQUE INDEX "Student_lineUserId_key" ON "Student"("lineUserId");
