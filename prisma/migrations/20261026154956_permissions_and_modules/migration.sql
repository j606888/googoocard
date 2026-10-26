-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "grants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revokes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ClassroomModule" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledById" INTEGER,

    CONSTRAINT "ClassroomModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomModule_classroomId_module_key" ON "ClassroomModule"("classroomId", "module");

-- AddForeignKey
ALTER TABLE "ClassroomModule" ADD CONSTRAINT "ClassroomModule_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomModule" ADD CONSTRAINT "ClassroomModule_enabledById_fkey" FOREIGN KEY ("enabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
