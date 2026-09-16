-- CreateTable
CREATE TABLE "RenewalReminder" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "studentCardId" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenewalReminder_studentId_sentAt_idx" ON "RenewalReminder"("studentId", "sentAt");

-- AddForeignKey
ALTER TABLE "RenewalReminder" ADD CONSTRAINT "RenewalReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
