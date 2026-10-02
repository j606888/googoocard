-- AlterTable: classroom-scoped counter for student card serials (#A0001…).
ALTER TABLE "Classroom" ADD COLUMN "nextCardSerial" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: add nullable first — existing rows get backfilled below before
-- the NOT NULL constraint is applied.
ALTER TABLE "StudentCard" ADD COLUMN "serialNumber" INTEGER;

-- Backfill: per-classroom sequential number, ordered by createdAt then id.
-- StudentCard has no classroomId, so the classroom comes from its Student.
WITH numbered AS (
  SELECT sc."id", ROW_NUMBER() OVER (
    PARTITION BY s."classroomId" ORDER BY sc."createdAt" ASC, sc."id" ASC
  ) AS rn
  FROM "StudentCard" sc
  JOIN "Student" s ON s."id" = sc."studentId"
)
UPDATE "StudentCard" sc
SET "serialNumber" = numbered.rn
FROM numbered
WHERE sc."id" = numbered."id";

-- Point each classroom's counter past the backfilled max.
UPDATE "Classroom" c
SET "nextCardSerial" = COALESCE(
  (SELECT MAX(sc."serialNumber") + 1
     FROM "StudentCard" sc
     JOIN "Student" s ON s."id" = sc."studentId"
    WHERE s."classroomId" = c."id"),
  1
);

ALTER TABLE "StudentCard" ALTER COLUMN "serialNumber" SET NOT NULL;
CREATE INDEX "StudentCard_serialNumber_idx" ON "StudentCard"("serialNumber");
