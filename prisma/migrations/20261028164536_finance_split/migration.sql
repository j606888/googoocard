-- CreateEnum
CREATE TYPE "FinanceRuleScope" AS ENUM ('CLASSROOM', 'LOCATION', 'LESSON');

-- CreateEnum
CREATE TYPE "FinanceTeacherPay" AS ENUM ('NONE', 'HOURLY', 'SPLIT');

-- CreateEnum
CREATE TYPE "FinanceFeeMode" AS ENUM ('NONE', 'PER_LESSON', 'PER_DAY');

-- CreateEnum
CREATE TYPE "FinanceVenuePayee" AS ENUM ('MEMBER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FinanceRemainderTo" AS ENUM ('REVENUE_OWNER', 'FUND');

-- CreateEnum
CREATE TYPE "FinanceLineKind" AS ENUM ('TEACHER', 'VENUE', 'ASSISTANT', 'REMAINDER');

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "locationId" INTEGER;

-- AlterTable
ALTER TABLE "FinanceSetting" ADD COLUMN     "payday" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "FinanceSplitRule" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "scope" "FinanceRuleScope" NOT NULL,
    "locationId" INTEGER,
    "lessonId" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "teacherPay" "FinanceTeacherPay",
    "hourlyFee" INTEGER,
    "venueMode" "FinanceFeeMode",
    "venueAmount" INTEGER,
    "venuePayee" "FinanceVenuePayee",
    "venueTeacherId" INTEGER,
    "assistantMode" "FinanceFeeMode",
    "assistantAmount" INTEGER,
    "commissionPct" INTEGER,
    "manual" BOOLEAN,
    "roundTo" INTEGER,
    "remainderTo" "FinanceRemainderTo",
    "reason" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSplitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSplitShare" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,

    CONSTRAINT "FinanceSplitShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLessonSettlement" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "inputsKey" TEXT NOT NULL,
    "ruleIds" INTEGER[],
    "revenue" INTEGER NOT NULL,
    "estimated" INTEGER NOT NULL DEFAULT 0,
    "attendeeCount" INTEGER NOT NULL,
    "venueFee" INTEGER NOT NULL,
    "assistantFee" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL,
    "remainder" INTEGER NOT NULL,
    "fund" INTEGER NOT NULL,
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "verifiedById" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLessonSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettlementLine" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "kind" "FinanceLineKind" NOT NULL,
    "teacherId" INTEGER,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FinanceSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettlementRevision" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "editedById" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSettlementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceSplitRule_classroomId_scope_effectiveFrom_idx" ON "FinanceSplitRule"("classroomId", "scope", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FinanceSplitRule_locationId_idx" ON "FinanceSplitRule"("locationId");

-- CreateIndex
CREATE INDEX "FinanceSplitRule_lessonId_idx" ON "FinanceSplitRule"("lessonId");

-- CreateIndex
CREATE INDEX "FinanceSplitRule_venueTeacherId_idx" ON "FinanceSplitRule"("venueTeacherId");

-- CreateIndex
CREATE INDEX "FinanceSplitShare_teacherId_idx" ON "FinanceSplitShare"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSplitShare_ruleId_teacherId_key" ON "FinanceSplitShare"("ruleId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLessonSettlement_lessonPeriodId_key" ON "FinanceLessonSettlement"("lessonPeriodId");

-- CreateIndex
CREATE INDEX "FinanceLessonSettlement_classroomId_verifiedAt_idx" ON "FinanceLessonSettlement"("classroomId", "verifiedAt");

-- CreateIndex
CREATE INDEX "FinanceLessonSettlement_verifiedById_idx" ON "FinanceLessonSettlement"("verifiedById");

-- CreateIndex
CREATE INDEX "FinanceSettlementLine_settlementId_idx" ON "FinanceSettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "FinanceSettlementLine_teacherId_idx" ON "FinanceSettlementLine"("teacherId");

-- CreateIndex
CREATE INDEX "FinanceSettlementRevision_settlementId_idx" ON "FinanceSettlementRevision"("settlementId");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitRule" ADD CONSTRAINT "FinanceSplitRule_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitRule" ADD CONSTRAINT "FinanceSplitRule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitRule" ADD CONSTRAINT "FinanceSplitRule_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitRule" ADD CONSTRAINT "FinanceSplitRule_venueTeacherId_fkey" FOREIGN KEY ("venueTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitShare" ADD CONSTRAINT "FinanceSplitShare_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FinanceSplitRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplitShare" ADD CONSTRAINT "FinanceSplitShare_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLessonSettlement" ADD CONSTRAINT "FinanceLessonSettlement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLessonSettlement" ADD CONSTRAINT "FinanceLessonSettlement_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLessonSettlement" ADD CONSTRAINT "FinanceLessonSettlement_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettlementLine" ADD CONSTRAINT "FinanceSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FinanceLessonSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettlementLine" ADD CONSTRAINT "FinanceSettlementLine_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettlementRevision" ADD CONSTRAINT "FinanceSettlementRevision_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FinanceLessonSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
