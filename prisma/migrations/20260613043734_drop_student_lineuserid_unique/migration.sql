-- DropIndex
DROP INDEX "Student_lineUserId_key";

-- CreateIndex
CREATE INDEX "Student_lineUserId_idx" ON "Student"("lineUserId");
