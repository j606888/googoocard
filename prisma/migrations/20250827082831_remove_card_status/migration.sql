/*
  Warnings:

  - You are about to drop the column `cardStatus` on the `AttendanceRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "cardStatus";

-- DropEnum
DROP TYPE "CardStatus";
