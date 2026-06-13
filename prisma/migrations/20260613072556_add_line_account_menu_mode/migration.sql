-- CreateEnum
CREATE TYPE "LineMenuMode" AS ENUM ('TEACHER', 'STUDENT');

-- CreateTable
CREATE TABLE "LineAccount" (
    "lineUserId" TEXT NOT NULL,
    "menuMode" "LineMenuMode" NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineAccount_pkey" PRIMARY KEY ("lineUserId")
);
