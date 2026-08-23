-- Index every foreign key that isn't already covered.
--
-- Postgres does not create indexes for foreign keys, and neither does Prisma,
-- so until now every `where: { classroomId }` / `where: { studentId }` was a
-- sequential scan. Columns that lead a composite @@unique (Student.classroomId,
-- Membership.userId, AttendanceRecord.lessonPeriodId, StudentTag.studentId,
-- LessonStudent.lessonId, LessonCard/LessonTeacher.lessonId,
-- StudentDanceQualification.studentId) are already served by that index and are
-- deliberately NOT duplicated here.
--
-- Plain CREATE INDEX, not CONCURRENTLY: Prisma Migrate runs each migration
-- inside a transaction and CONCURRENTLY cannot run there. These tables hold
-- hundreds to low thousands of rows, so each index builds in milliseconds; the
-- SHARE lock blocks writes (not reads) for that long. Revisit if any table
-- reaches the millions, at which point the build needs to move out of Prisma.

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentCardId_idx" ON "AttendanceRecord"("studentCardId");

-- CreateIndex
CREATE INDEX "Card_classroomId_idx" ON "Card"("classroomId");

-- CreateIndex
CREATE INDEX "Event_studentId_createdAt_idx" ON "Event"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteToken_classroomId_idx" ON "InviteToken"("classroomId");

-- CreateIndex
CREATE INDEX "Lesson_classroomId_idx" ON "Lesson"("classroomId");

-- CreateIndex
CREATE INDEX "Lesson_groupId_idx" ON "Lesson"("groupId");

-- CreateIndex
CREATE INDEX "LessonCard_cardId_idx" ON "LessonCard"("cardId");

-- CreateIndex
CREATE INDEX "LessonGroup_classroomId_idx" ON "LessonGroup"("classroomId");

-- CreateIndex
CREATE INDEX "LessonPeriod_lessonId_startTime_idx" ON "LessonPeriod"("lessonId", "startTime");

-- CreateIndex
CREATE INDEX "LessonStudent_studentId_idx" ON "LessonStudent"("studentId");

-- CreateIndex
CREATE INDEX "LessonTeacher_teacherId_idx" ON "LessonTeacher"("teacherId");

-- CreateIndex
CREATE INDEX "Membership_classroomId_idx" ON "Membership"("classroomId");

-- CreateIndex
CREATE INDEX "StudentCard_studentId_expiredAt_idx" ON "StudentCard"("studentId", "expiredAt");

-- CreateIndex
CREATE INDEX "StudentCard_cardId_idx" ON "StudentCard"("cardId");

-- CreateIndex
CREATE INDEX "StudentTag_tagId_idx" ON "StudentTag"("tagId");

-- CreateIndex
CREATE INDEX "Tag_classroomId_idx" ON "Tag"("classroomId");

-- CreateIndex
CREATE INDEX "Teacher_classroomId_idx" ON "Teacher"("classroomId");
