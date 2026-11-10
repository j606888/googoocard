-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "dropInOptions" JSONB;

-- AlterTable
ALTER TABLE "DropInCharge" ADD COLUMN     "optionName" TEXT;
