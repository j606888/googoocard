-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "financeStartAt" TIMESTAMP(3),
ADD COLUMN     "keeperUserId" INTEGER;

-- AlterTable
ALTER TABLE "StudentCard" ADD COLUMN     "homeLocationId" INTEGER,
ADD COLUMN     "moneyLocationId" INTEGER;

-- CreateTable
CREATE TABLE "Venue" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "landlordUserId" INTEGER,
    "locationId" INTEGER,
    "perSessionPrice" INTEGER,
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
    "remainingAtStart" INTEGER,
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
CREATE TABLE "PeriodSettlement" (
    "id" SERIAL NOT NULL,
    "lessonPeriodId" INTEGER NOT NULL,
    "paidByUserId" INTEGER NOT NULL,
    "payerLocationId" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "PeriodSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchTransfer" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "fromLocationId" INTEGER NOT NULL,
    "toLocationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_classroomId_name_key" ON "Venue"("classroomId", "name");

-- CreateIndex
CREATE INDEX "VenuePack_classroomId_idx" ON "VenuePack"("classroomId");

-- CreateIndex
CREATE INDEX "VenuePack_venueId_idx" ON "VenuePack"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSplitRule_lessonId_key" ON "LessonSplitRule"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodSplitOverride_lessonPeriodId_key" ON "PeriodSplitOverride"("lessonPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodSettlement_lessonPeriodId_key" ON "PeriodSettlement"("lessonPeriodId");

-- CreateIndex
CREATE INDEX "PeriodSettlement_payerLocationId_idx" ON "PeriodSettlement"("payerLocationId");

-- CreateIndex
CREATE INDEX "BranchTransfer_classroomId_idx" ON "BranchTransfer"("classroomId");

-- CreateIndex
CREATE INDEX "StudentCard_moneyLocationId_idx" ON "StudentCard"("moneyLocationId");

-- CreateIndex
CREATE INDEX "StudentCard_homeLocationId_idx" ON "StudentCard"("homeLocationId");

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_moneyLocationId_fkey" FOREIGN KEY ("moneyLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePack" ADD CONSTRAINT "VenuePack_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePack" ADD CONSTRAINT "VenuePack_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSplitRule" ADD CONSTRAINT "LessonSplitRule_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSplitOverride" ADD CONSTRAINT "PeriodSplitOverride_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodSettlement" ADD CONSTRAINT "PeriodSettlement_lessonPeriodId_fkey" FOREIGN KEY ("lessonPeriodId") REFERENCES "LessonPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
