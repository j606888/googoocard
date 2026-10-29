-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "sessionsUsed" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "sessionsPerAttendance" INTEGER NOT NULL DEFAULT 1;
