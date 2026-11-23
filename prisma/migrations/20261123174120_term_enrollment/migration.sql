-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "enrollmentId" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "termPrice" INTEGER,
ADD COLUMN     "termSessions" INTEGER;

-- CreateTable
CREATE TABLE "LessonEnrollment" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "note" TEXT,
    "enrolledByUserId" INTEGER,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" INTEGER,
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodLeave" (
    "id" SERIAL NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonEnrollment_studentId_idx" ON "LessonEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonEnrollment_lessonId_studentId_key" ON "LessonEnrollment"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "PeriodLeave_lessonPeriodId_idx" ON "PeriodLeave"("lessonPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLeave_enrollmentId_lessonPeriodId_key" ON "PeriodLeave"("enrollmentId", "lessonPeriodId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LessonEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonEnrollment" ADD CONSTRAINT "LessonEnrollment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonEnrollment" ADD CONSTRAINT "LessonEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonEnrollment" ADD CONSTRAINT "LessonEnrollment_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonEnrollment" ADD CONSTRAINT "LessonEnrollment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLeave" ADD CONSTRAINT "PeriodLeave_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LessonEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLeave" ADD CONSTRAINT "PeriodLeave_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
