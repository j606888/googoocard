-- CreateEnum
CREATE TYPE "DanceType" AS ENUM ('BACHATA', 'SALSA');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "danceType" "DanceType" NOT NULL DEFAULT 'BACHATA';
