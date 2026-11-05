-- CreateTable
CREATE TABLE "FinanceBranchReview" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "locationId" INTEGER NOT NULL,
    "reviewedById" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "FinanceBranchReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBranchReview_classroomId_month_locationId_key" ON "FinanceBranchReview"("classroomId", "month", "locationId");

-- AddForeignKey
ALTER TABLE "FinanceBranchReview" ADD CONSTRAINT "FinanceBranchReview_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBranchReview" ADD CONSTRAINT "FinanceBranchReview_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
