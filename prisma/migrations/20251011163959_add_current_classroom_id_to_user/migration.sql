-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentClassroomId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentClassroomId_fkey" FOREIGN KEY ("currentClassroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
