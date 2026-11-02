-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "boundLessonId" INTEGER,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "financeEnabledAt" TIMESTAMP(3),
ADD COLUMN     "financeRoundTo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "legacyCustodianUserId" INTEGER,
ADD COLUMN     "legacyPrepaidConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "expiryTo" TEXT NOT NULL DEFAULT 'FUND',
ADD COLUMN     "expiryUserId" INTEGER,
ADD COLUMN     "fundOpening" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fundOpeningConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "keeperUserId" INTEGER;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "isFinance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "closedReason" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "giftFromId" INTEGER,
ADD COLUMN     "soldLocationId" INTEGER;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "payerUserId" INTEGER;

-- CreateTable
CREATE TABLE "Venue" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "landlordUserId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenuePack" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "venueId" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "paidByUserId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenuePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSplitRule" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "rule" JSONB NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSplitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodSplitOverride" (
    "id" SERIAL NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "rule" JSONB NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodSplitOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAbsence" (
    "id" SERIAL NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "studentCardId" INTEGER NOT NULL,
    "sessionsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceExpense" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "paidByUserId" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransfer" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toKind" TEXT NOT NULL,
    "toUserId" INTEGER,
    "toTeacherId" INTEGER,
    "toVenueId" INTEGER,
    "settlementMonth" TEXT,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRefund" (
    "id" SERIAL NOT NULL,
    "studentCardId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidByUserId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettlement" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "lockedById" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "FinanceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_classroomId_name_key" ON "Venue"("classroomId", "name");

-- CreateIndex
CREATE INDEX "VenuePack_classroomId_idx" ON "VenuePack"("classroomId");

-- CreateIndex
CREATE INDEX "VenuePack_venueId_idx" ON "VenuePack"("venueId");

-- CreateIndex
CREATE INDEX "VenuePack_paidByUserId_idx" ON "VenuePack"("paidByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSplitRule_lessonId_key" ON "LessonSplitRule"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodSplitOverride_lessonPeriodId_key" ON "PeriodSplitOverride"("lessonPeriodId");

-- CreateIndex
CREATE INDEX "AttendanceAbsence_studentId_idx" ON "AttendanceAbsence"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceAbsence_studentCardId_idx" ON "AttendanceAbsence"("studentCardId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAbsence_lessonPeriodId_studentId_key" ON "AttendanceAbsence"("lessonPeriodId", "studentId");

-- CreateIndex
CREATE INDEX "FinanceExpense_classroomId_date_idx" ON "FinanceExpense"("classroomId", "date");

-- CreateIndex
CREATE INDEX "FinanceExpense_locationId_idx" ON "FinanceExpense"("locationId");

-- CreateIndex
CREATE INDEX "FinanceExpense_paidByUserId_idx" ON "FinanceExpense"("paidByUserId");

-- CreateIndex
CREATE INDEX "FinanceTransfer_classroomId_date_idx" ON "FinanceTransfer"("classroomId", "date");

-- CreateIndex
CREATE INDEX "FinanceTransfer_fromUserId_idx" ON "FinanceTransfer"("fromUserId");

-- CreateIndex
CREATE INDEX "FinanceTransfer_toUserId_idx" ON "FinanceTransfer"("toUserId");

-- CreateIndex
CREATE INDEX "FinanceTransfer_toTeacherId_idx" ON "FinanceTransfer"("toTeacherId");

-- CreateIndex
CREATE INDEX "FinanceTransfer_toVenueId_idx" ON "FinanceTransfer"("toVenueId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRefund_studentCardId_key" ON "FinanceRefund"("studentCardId");

-- CreateIndex
CREATE INDEX "FinanceRefund_paidByUserId_idx" ON "FinanceRefund"("paidByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSettlement_classroomId_month_key" ON "FinanceSettlement"("classroomId", "month");

-- CreateIndex
CREATE INDEX "Card_boundLessonId_idx" ON "Card"("boundLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCard_giftFromId_key" ON "StudentCard"("giftFromId");

-- CreateIndex
CREATE INDEX "StudentCard_soldLocationId_idx" ON "StudentCard"("soldLocationId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_boundLessonId_fkey" FOREIGN KEY ("boundLessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_giftFromId_fkey" FOREIGN KEY ("giftFromId") REFERENCES "StudentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePack" ADD CONSTRAINT "VenuePack_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePack" ADD CONSTRAINT "VenuePack_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSplitRule" ADD CONSTRAINT "LessonSplitRule_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSplitOverride" ADD CONSTRAINT "PeriodSplitOverride_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAbsence" ADD CONSTRAINT "AttendanceAbsence_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAbsence" ADD CONSTRAINT "AttendanceAbsence_studentCardId_fkey" FOREIGN KEY ("studentCardId") REFERENCES "StudentCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransfer" ADD CONSTRAINT "FinanceTransfer_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRefund" ADD CONSTRAINT "FinanceRefund_studentCardId_fkey" FOREIGN KEY ("studentCardId") REFERENCES "StudentCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettlement" ADD CONSTRAINT "FinanceSettlement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

