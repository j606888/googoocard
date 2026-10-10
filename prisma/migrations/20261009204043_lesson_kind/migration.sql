-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'fixed';
