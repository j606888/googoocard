-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "lineListed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "locationId" INTEGER;

-- AlterTable
ALTER TABLE "LineAccount" ADD COLUMN     "browseClassroomId" INTEGER;

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_classroomId_name_key" ON "Location"("classroomId", "name");

-- CreateIndex
CREATE INDEX "Lesson_locationId_idx" ON "Lesson"("locationId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
