-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('SUCCESS', 'MISSING_CARD', 'MULTIPLE_CARDS');

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "cardStatus" "CardStatus";
