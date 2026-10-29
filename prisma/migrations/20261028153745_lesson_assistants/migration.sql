-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "isAssistant" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LessonPeriodAssistant" (
    "id" SERIAL NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPeriodAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPeriodAssistant_teacherId_idx" ON "LessonPeriodAssistant"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPeriodAssistant_lessonPeriodId_teacherId_key" ON "LessonPeriodAssistant"("lessonPeriodId", "teacherId");

-- AddForeignKey
ALTER TABLE "LessonPeriodAssistant" ADD CONSTRAINT "LessonPeriodAssistant_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPeriodAssistant" ADD CONSTRAINT "LessonPeriodAssistant_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
