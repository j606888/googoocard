/*
  Warnings:

  - You are about to drop the column `date` on the `LessonPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `timeFrom` on the `LessonPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `timeTo` on the `LessonPeriod` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `LessonPeriod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `LessonPeriod` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LessonPeriod" DROP COLUMN "date",
DROP COLUMN "timeFrom",
DROP COLUMN "timeTo",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;
