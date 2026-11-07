-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'BANK', 'EWALLET');

-- CreateEnum
CREATE TYPE "JournalEntryKind" AS ENUM ('AUTO', 'CORRECTION', 'OPENING', 'MANUAL', 'REVERSAL');

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "financeConversionDate" DATE,
ADD COLUMN     "financeLockDate" DATE;

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

    CONSTRAINT "PostingSource_pkey" PRIMARY KEY ("classroomId","sourceType","sourceId")
);

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
