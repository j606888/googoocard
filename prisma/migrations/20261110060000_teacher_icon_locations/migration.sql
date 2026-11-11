-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "_LocationToTeacher" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_LocationToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LocationToTeacher_B_index" ON "_LocationToTeacher"("B");

-- AddForeignKey
ALTER TABLE "_LocationToTeacher" ADD CONSTRAINT "_LocationToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationToTeacher" ADD CONSTRAINT "_LocationToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

