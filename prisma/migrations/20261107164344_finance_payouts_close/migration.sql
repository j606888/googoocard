-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OwnerTxnKind" AS ENUM ('CONTRIBUTION', 'DRAWING', 'DIVIDEND');

-- AlterTable
ALTER TABLE "FinanceExpense" ADD COLUMN     "isAdvance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moneyAccountId" INTEGER;

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
