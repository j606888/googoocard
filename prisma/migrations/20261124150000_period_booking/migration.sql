-- CreateTable
CREATE TABLE "PeriodBooking" (
    "id" SERIAL NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodBooking_studentId_idx" ON "PeriodBooking"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodBooking_lessonPeriodId_studentId_key" ON "PeriodBooking"("lessonPeriodId", "studentId");

-- AddForeignKey
ALTER TABLE "PeriodBooking" ADD CONSTRAINT "PeriodBooking_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodBooking" ADD CONSTRAINT "PeriodBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodBooking" ADD CONSTRAINT "PeriodBooking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

