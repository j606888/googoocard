-- AlterTable: add classroom-scoped auto-incrementing counter
ALTER TABLE "Classroom" ADD COLUMN "nextStudentNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: add nullable first — existing rows get backfilled below before
-- the NOT NULL + unique constraints are applied.
ALTER TABLE "Student" ADD COLUMN "number" INTEGER;

-- Backfill: per-classroom sequential number, ordered by createdAt then id
-- (createdAt has ms precision and bulk inserts/seeds can collide, so id
-- is the tiebreaker for a stable order).
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "classroomId" ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "Student"
)
UPDATE "Student" s
SET "number" = numbered.rn
FROM numbered
WHERE s.id = numbered.id;

-- Point each classroom's counter past the backfilled max so new students
-- continue the sequence instead of colliding with it.
UPDATE "Classroom" c
SET "nextStudentNumber" = COALESCE(
  (SELECT MAX(s."number") + 1 FROM "Student" s WHERE s."classroomId" = c.id),
  1
);

-- Now that every row has a number, enforce NOT NULL + per-classroom uniqueness.
ALTER TABLE "Student" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "Student_classroomId_number_key" ON "Student"("classroomId", "number");
