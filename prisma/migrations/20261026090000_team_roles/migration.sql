-- AlterTable
ALTER TABLE "InviteToken" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'assistant',
ADD COLUMN     "teacherId" INTEGER;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE INDEX "InviteToken_teacherId_idx" ON "InviteToken"("teacherId");

-- CreateIndex
CREATE INDEX "Teacher_userId_idx" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_classroomId_userId_key" ON "Teacher"("classroomId", "userId");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

