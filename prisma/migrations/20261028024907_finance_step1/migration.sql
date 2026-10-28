-- CreateEnum
CREATE TYPE "FinanceRemittanceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "FinanceSetting" (
    "classroomId" INTEGER NOT NULL,
    "revenueOwnerUserId" INTEGER,
    "startDate" TIMESTAMP(3),
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "openingOwnerLoan" INTEGER,
    "overdueDays" INTEGER NOT NULL DEFAULT 7,
    "setupCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSetting_pkey" PRIMARY KEY ("classroomId")
);

-- CreateTable
CREATE TABLE "FinanceOpeningCustody" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FinanceOpeningCustody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRemittance" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "sentOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "FinanceRemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payeeUserId" INTEGER,
    "payeeName" TEXT,
    "description" TEXT,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntryRevision" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "editedById" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettingRevision" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "editedById" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSettingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceQuestDone" (
    "userId" INTEGER NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "quest" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceQuestDone_pkey" PRIMARY KEY ("userId","classroomId","quest")
);

-- CreateIndex
CREATE INDEX "FinanceSetting_revenueOwnerUserId_idx" ON "FinanceSetting"("revenueOwnerUserId");

-- CreateIndex
CREATE INDEX "FinanceOpeningCustody_userId_idx" ON "FinanceOpeningCustody"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceOpeningCustody_classroomId_userId_key" ON "FinanceOpeningCustody"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "FinanceRemittance_classroomId_status_idx" ON "FinanceRemittance"("classroomId", "status");

-- CreateIndex
CREATE INDEX "FinanceRemittance_fromUserId_idx" ON "FinanceRemittance"("fromUserId");

-- CreateIndex
CREATE INDEX "FinanceRemittance_reviewedById_idx" ON "FinanceRemittance"("reviewedById");

-- CreateIndex
CREATE INDEX "FinanceEntry_classroomId_date_idx" ON "FinanceEntry"("classroomId", "date");

-- CreateIndex
CREATE INDEX "FinanceEntry_payeeUserId_idx" ON "FinanceEntry"("payeeUserId");

-- CreateIndex
CREATE INDEX "FinanceEntry_createdById_idx" ON "FinanceEntry"("createdById");

-- CreateIndex
CREATE INDEX "FinanceEntryRevision_entryId_idx" ON "FinanceEntryRevision"("entryId");

-- CreateIndex
CREATE INDEX "FinanceEntryRevision_editedById_idx" ON "FinanceEntryRevision"("editedById");

-- CreateIndex
CREATE INDEX "FinanceSettingRevision_classroomId_idx" ON "FinanceSettingRevision"("classroomId");

-- CreateIndex
CREATE INDEX "FinanceSettingRevision_editedById_idx" ON "FinanceSettingRevision"("editedById");

-- CreateIndex
CREATE INDEX "FinanceQuestDone_classroomId_idx" ON "FinanceQuestDone"("classroomId");

-- AddForeignKey
ALTER TABLE "FinanceSetting" ADD CONSTRAINT "FinanceSetting_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSetting" ADD CONSTRAINT "FinanceSetting_revenueOwnerUserId_fkey" FOREIGN KEY ("revenueOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceOpeningCustody" ADD CONSTRAINT "FinanceOpeningCustody_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceOpeningCustody" ADD CONSTRAINT "FinanceOpeningCustody_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRemittance" ADD CONSTRAINT "FinanceRemittance_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRemittance" ADD CONSTRAINT "FinanceRemittance_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRemittance" ADD CONSTRAINT "FinanceRemittance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_payeeUserId_fkey" FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntryRevision" ADD CONSTRAINT "FinanceEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntryRevision" ADD CONSTRAINT "FinanceEntryRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettingRevision" ADD CONSTRAINT "FinanceSettingRevision_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettingRevision" ADD CONSTRAINT "FinanceSettingRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuestDone" ADD CONSTRAINT "FinanceQuestDone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuestDone" ADD CONSTRAINT "FinanceQuestDone_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
