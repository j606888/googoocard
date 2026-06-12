-- AlterTable
ALTER TABLE "User" ADD COLUMN "randomKey" TEXT,
ADD COLUMN "lineUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_randomKey_key" ON "User"("randomKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");
