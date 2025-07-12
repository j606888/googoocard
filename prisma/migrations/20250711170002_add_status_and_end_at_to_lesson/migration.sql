-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'inProgress';
