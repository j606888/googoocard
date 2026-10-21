-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "color" TEXT NOT NULL DEFAULT 'blue',
ADD COLUMN     "note" TEXT;

-- Give existing teachers distinct colours within their classroom instead of
-- all starting blue (same palette order as new teachers pick from).
UPDATE "Teacher" AS t
SET "color" = (ARRAY['blue','orange','purple','teal','pink','indigo','red','green','slate','stone'])[((r.rn - 1) % 10) + 1]
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "classroomId" ORDER BY "id") AS rn
  FROM "Teacher"
) AS r
WHERE t."id" = r."id";
