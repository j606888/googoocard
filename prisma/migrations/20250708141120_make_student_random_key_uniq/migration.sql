/*
  Warnings:

  - A unique constraint covering the columns `[randomKey]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Student_randomKey_key" ON "Student"("randomKey");
