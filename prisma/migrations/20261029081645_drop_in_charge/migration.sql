-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "dropInPrice" INTEGER;

-- CreateTable
CREATE TABLE "DropInCharge" (
    "id" SERIAL NOT NULL,
    "attendanceRecordId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "paidByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropInCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DropInCharge_attendanceRecordId_key" ON "DropInCharge"("attendanceRecordId");

-- AddForeignKey
ALTER TABLE "DropInCharge" ADD CONSTRAINT "DropInCharge_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropInCharge" ADD CONSTRAINT "DropInCharge_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
