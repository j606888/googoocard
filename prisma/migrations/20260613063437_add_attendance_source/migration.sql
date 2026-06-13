-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('TEACHER', 'STUDENT');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'TEACHER';
