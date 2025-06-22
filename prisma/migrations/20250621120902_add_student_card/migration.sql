-- CreateTable
CREATE TABLE "StudentCard" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "cardId" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "remainingSessions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCard_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
