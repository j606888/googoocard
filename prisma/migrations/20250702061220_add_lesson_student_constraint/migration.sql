/*
  Warnings:

  - A unique constraint covering the columns `[lessonId,studentId]` on the table `LessonStudent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LessonStudent_lessonId_studentId_key" ON "LessonStudent"("lessonId", "studentId");
