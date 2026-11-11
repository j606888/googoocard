-- CreateTable
CREATE TABLE "LessonAssistant" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonAssistant_teacherId_idx" ON "LessonAssistant"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonAssistant_lessonId_teacherId_key" ON "LessonAssistant"("lessonId", "teacherId");

-- AddForeignKey
ALTER TABLE "LessonAssistant" ADD CONSTRAINT "LessonAssistant_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAssistant" ADD CONSTRAINT "LessonAssistant_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

