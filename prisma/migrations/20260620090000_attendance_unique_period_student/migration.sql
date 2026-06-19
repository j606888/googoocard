-- One attendance record per (period, student): guards against duplicate
-- self check-ins double-charging a card. Dev/prod verified free of dupes
-- before adding the constraint.
CREATE UNIQUE INDEX "AttendanceRecord_lessonPeriodId_studentId_key" ON "AttendanceRecord"("lessonPeriodId", "studentId");
