/*
  Warnings:

  - You are about to drop the column `has_completed_bachata_lv1` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `has_completed_salsa_lv1` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "has_completed_bachata_lv1",
DROP COLUMN "has_completed_salsa_lv1",
ADD COLUMN     "hasCompletedBachataLv1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCompletedSalsaLv1" BOOLEAN NOT NULL DEFAULT false;
