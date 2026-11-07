-- 財務（feat/finance＋財務 v2，docs/finance-v2/）。原本 9 個 migration 在合併前壓成這一個（04 §7）。

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'BANK', 'EWALLET');

-- CreateEnum
CREATE TYPE "JournalEntryKind" AS ENUM ('AUTO', 'CORRECTION', 'OPENING', 'MANUAL', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OwnerTxnKind" AS ENUM ('CONTRIBUTION', 'DRAWING', 'DIVIDEND');

-- AlterEnum
BEGIN;
-- 「兩者皆是」併入老師（feat/finance）
UPDATE "Teacher" SET "kind" = 'TEACHER' WHERE "kind" = 'BOTH';
CREATE TYPE "TeacherKind_new" AS ENUM ('TEACHER', 'ASSISTANT');
ALTER TABLE "Teacher" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Teacher" ALTER COLUMN "kind" TYPE "TeacherKind_new" USING ("kind"::text::"TeacherKind_new");
ALTER TYPE "TeacherKind" RENAME TO "TeacherKind_old";
ALTER TYPE "TeacherKind_new" RENAME TO "TeacherKind";
DROP TYPE "TeacherKind_old";
ALTER TABLE "Teacher" ALTER COLUMN "kind" SET DEFAULT 'TEACHER';
COMMIT;

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "financeConversionDate" DATE,
ADD COLUMN     "financeEnabledAt" TIMESTAMP(3),
ADD COLUMN     "financeLockDate" DATE,
ADD COLUMN     "financeNoVenueFee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "financeOpenedAt" TIMESTAMP(3),
ADD COLUMN     "financeOpening" JSONB,
ADD COLUMN     "financeRoundTo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "legacyCustodianUserId" INTEGER;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "canSettle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCustodian" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "payerUserId" INTEGER;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "boundLessonId" INTEGER,
ADD COLUMN     "isGift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "closedReason" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "giftFromId" INTEGER,
ADD COLUMN     "soldLocationId" INTEGER;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "expiryTo" TEXT NOT NULL DEFAULT 'FUND',
ADD COLUMN     "expiryUserId" INTEGER,
ADD COLUMN     "keeperUserId" INTEGER;

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
    "moneyAccountId" INTEGER,
    "isAdvance" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceExpense_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "LedgerAccount" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "systemKey" TEXT,
    "parentId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MoneyAccountKind" NOT NULL DEFAULT 'CASH',
    "holderUserId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "JournalEntryKind" NOT NULL,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "memo" TEXT,
    "reversesId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "accountId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "partyType" TEXT,
    "partyId" INTEGER,
    "lessonPeriodId" INTEGER,
    "memo" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingSource" (
    "classroomId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "hash" TEXT,
    "dirtyAt" TIMESTAMP(3),
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostingSource_pkey" PRIMARY KEY ("classroomId","sourceType","sourceId")
);

-- CreateTable
CREATE TABLE "PayoutRun" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "asOf" DATE NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "runId" INTEGER,
    "partyType" TEXT NOT NULL,
    "partyId" INTEGER NOT NULL,
    "payableKey" TEXT NOT NULL,
    "locationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "fromMoneyAccountId" INTEGER,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidDate" DATE,
    "paidById" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransfer" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "runId" INTEGER,
    "fromMoneyAccountId" INTEGER NOT NULL,
    "toMoneyAccountId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "settleAmount" INTEGER,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PAID',
    "date" DATE,
    "note" TEXT,
    "doneById" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerTransaction" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "kind" "OwnerTxnKind" NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "moneyAccountId" INTEGER,
    "locationId" INTEGER,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCount" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "moneyAccountId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "systemBalance" INTEGER NOT NULL,
    "counted" INTEGER NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLockLog" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,
    "userId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceLockLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCloseSignoff" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "asOf" DATE NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCloseSignoff_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "FinanceRefund_studentCardId_key" ON "FinanceRefund"("studentCardId");

-- CreateIndex
CREATE INDEX "FinanceRefund_paidByUserId_idx" ON "FinanceRefund"("paidByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_classroomId_code_key" ON "LedgerAccount"("classroomId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_classroomId_systemKey_key" ON "LedgerAccount"("classroomId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_accountId_key" ON "MoneyAccount"("accountId");

-- CreateIndex
CREATE INDEX "MoneyAccount_classroomId_holderUserId_idx" ON "MoneyAccount"("classroomId", "holderUserId");

-- CreateIndex
CREATE INDEX "JournalEntry_classroomId_date_idx" ON "JournalEntry"("classroomId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_classroomId_sourceType_sourceId_idx" ON "JournalEntry"("classroomId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_classroomId_accountId_date_idx" ON "JournalLine"("classroomId", "accountId", "date");

-- CreateIndex
CREATE INDEX "JournalLine_classroomId_locationId_date_idx" ON "JournalLine"("classroomId", "locationId", "date");

-- CreateIndex
CREATE INDEX "JournalLine_classroomId_partyType_partyId_idx" ON "JournalLine"("classroomId", "partyType", "partyId");

-- CreateIndex
CREATE INDEX "PostingSource_classroomId_dirtyAt_idx" ON "PostingSource"("classroomId", "dirtyAt");

-- CreateIndex
CREATE INDEX "PayoutRun_classroomId_asOf_idx" ON "PayoutRun"("classroomId", "asOf");

-- CreateIndex
CREATE INDEX "Payout_classroomId_status_idx" ON "Payout"("classroomId", "status");

-- CreateIndex
CREATE INDEX "Payout_runId_idx" ON "Payout"("runId");

-- CreateIndex
CREATE INDEX "MoneyTransfer_classroomId_status_idx" ON "MoneyTransfer"("classroomId", "status");

-- CreateIndex
CREATE INDEX "MoneyTransfer_runId_idx" ON "MoneyTransfer"("runId");

-- CreateIndex
CREATE INDEX "OwnerTransaction_classroomId_date_idx" ON "OwnerTransaction"("classroomId", "date");

-- CreateIndex
CREATE INDEX "CashCount_classroomId_moneyAccountId_date_idx" ON "CashCount"("classroomId", "moneyAccountId", "date");

-- CreateIndex
CREATE INDEX "FinanceLockLog_classroomId_createdAt_idx" ON "FinanceLockLog"("classroomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCloseSignoff_classroomId_locationId_asOf_key" ON "FinanceCloseSignoff"("classroomId", "locationId", "asOf");

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
ALTER TABLE "FinanceRefund" ADD CONSTRAINT "FinanceRefund_studentCardId_fkey" FOREIGN KEY ("studentCardId") REFERENCES "StudentCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingSource" ADD CONSTRAINT "PostingSource_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRun" ADD CONSTRAINT "PayoutRun_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransfer" ADD CONSTRAINT "MoneyTransfer_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransfer" ADD CONSTRAINT "MoneyTransfer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerTransaction" ADD CONSTRAINT "OwnerTransaction_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLockLog" ADD CONSTRAINT "FinanceLockLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCloseSignoff" ADD CONSTRAINT "FinanceCloseSignoff_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
