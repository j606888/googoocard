-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_studentCardId_fkey";

-- AlterTable
ALTER TABLE "AttendanceRecord" ALTER COLUMN "studentCardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentCardId_fkey" FOREIGN KEY ("studentCardId") REFERENCES "StudentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
