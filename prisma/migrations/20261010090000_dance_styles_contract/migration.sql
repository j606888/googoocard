-- Contract step of the DanceStyle switch: every row now points at a style, so
-- the DanceType enum, its three columns and DanceStyle.legacyDanceType go.
-- Apply only after the danceStyleId code is live (the deployed Prisma client
-- must no longer select the dropped columns).
--
-- 1. Rows the old code wrote after the last backfill still carry only the enum.
--    A qualification among them may collide with a row the new code already
--    wrote for the same student and style; fold it into that row (keeping the
--    higher level) so the backfill below can't hit
--    @@unique([studentId, danceStyleId]).
-- 2. The backfill block, verbatim (tests/api/dance-style-backfill.test.ts).
-- 3. Refuse to continue if anything is still unfilled, then drop.

UPDATE "StudentDanceQualification" kept
SET "level" = GREATEST(kept."level", legacy."level")
FROM "StudentDanceQualification" legacy, "Student" s, "DanceStyle" ds
WHERE legacy."danceStyleId" IS NULL
  AND s."id" = legacy."studentId"
  AND ds."classroomId" = s."classroomId"
  AND ds."legacyDanceType" = legacy."danceType"
  AND kept."studentId" = legacy."studentId"
  AND kept."danceStyleId" = ds."id";

DELETE FROM "StudentDanceQualification" legacy
USING "Student" s, "DanceStyle" ds, "StudentDanceQualification" kept
WHERE legacy."danceStyleId" IS NULL
  AND s."id" = legacy."studentId"
  AND ds."classroomId" = s."classroomId"
  AND ds."legacyDanceType" = legacy."danceType"
  AND kept."studentId" = legacy."studentId"
  AND kept."danceStyleId" = ds."id";

-- BACKFILL BEGIN

-- 1. Adopt a style the classroom already created by hand under the same name.
UPDATE "DanceStyle" ds
SET "legacyDanceType" = m.dt
FROM (VALUES
  ('BACHATA'::"DanceType", 'Bachata'),
  ('SALSA'::"DanceType", 'Salsa'),
  ('ZOUK'::"DanceType", 'Zouk'),
  ('HUSTLE'::"DanceType", 'Hustle'),
  ('KIZOMBA'::"DanceType", 'Kizomba')
) AS m(dt, name)
WHERE ds."legacyDanceType" IS NULL
  AND ds."name" = m.name
  AND NOT EXISTS (
    SELECT 1 FROM "DanceStyle" o
    WHERE o."classroomId" = ds."classroomId" AND o."legacyDanceType" = m.dt
  );

-- 2. One style per (classroom, enum value) still referenced by an unfilled row.
-- hasLevels is on when that classroom has any lesson or qualification of the
-- type above level 1 (decided only at creation; never flipped on re-run).
INSERT INTO "DanceStyle" ("classroomId", "name", "color", "hasLevels", "sortOrder", "legacyDanceType", "updatedAt")
SELECT u."classroomId", m.name, m.color,
  EXISTS (
    SELECT 1 FROM "Lesson" l
    WHERE l."classroomId" = u."classroomId" AND l."danceType" = m.dt AND l."level" > 1
  ) OR EXISTS (
    SELECT 1 FROM "StudentDanceQualification" q
    JOIN "Student" s ON s."id" = q."studentId"
    WHERE s."classroomId" = u."classroomId" AND q."danceType" = m.dt AND q."level" > 1
  ),
  m.ord, m.dt, CURRENT_TIMESTAMP
FROM (
  SELECT "classroomId", "danceType" FROM "Lesson" WHERE "danceStyleId" IS NULL
  UNION
  SELECT "classroomId", "danceType" FROM "Card"
  WHERE "danceStyleId" IS NULL AND "danceType" IS NOT NULL
  UNION
  SELECT s."classroomId", q."danceType" FROM "StudentDanceQualification" q
  JOIN "Student" s ON s."id" = q."studentId"
  WHERE q."danceStyleId" IS NULL AND q."danceType" IS NOT NULL
) AS u
JOIN (VALUES
  ('BACHATA'::"DanceType", 'Bachata', 'green', 0),
  ('SALSA'::"DanceType", 'Salsa', 'orange', 1),
  ('ZOUK'::"DanceType", 'Zouk', 'slate', 2),
  ('HUSTLE'::"DanceType", 'Hustle', 'stone', 3),
  ('KIZOMBA'::"DanceType", 'Kizomba', 'purple', 4)
) AS m(dt, name, color, ord) ON m.dt = u."danceType"
ON CONFLICT DO NOTHING;

-- 3. Point the three tables at their style.
UPDATE "Lesson" l
SET "danceStyleId" = ds."id"
FROM "DanceStyle" ds
WHERE l."danceStyleId" IS NULL
  AND ds."classroomId" = l."classroomId"
  AND ds."legacyDanceType" = l."danceType";

UPDATE "Card" c
SET "danceStyleId" = ds."id"
FROM "DanceStyle" ds
WHERE c."danceStyleId" IS NULL
  AND ds."classroomId" = c."classroomId"
  AND ds."legacyDanceType" = c."danceType";

UPDATE "StudentDanceQualification" q
SET "danceStyleId" = ds."id"
FROM "Student" s, "DanceStyle" ds
WHERE q."danceStyleId" IS NULL
  AND s."id" = q."studentId"
  AND ds."classroomId" = s."classroomId"
  AND ds."legacyDanceType" = q."danceType";

-- BACKFILL END

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Lesson" WHERE "danceStyleId" IS NULL)
    OR EXISTS (SELECT 1 FROM "StudentDanceQualification" WHERE "danceStyleId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Card" WHERE "danceStyleId" IS NULL AND "danceType" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'dance_styles_contract: rows without a danceStyleId remain';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_danceStyleId_fkey";

-- DropForeignKey
ALTER TABLE "StudentDanceQualification" DROP CONSTRAINT "StudentDanceQualification_danceStyleId_fkey";

-- DropIndex
DROP INDEX "DanceStyle_classroomId_legacyDanceType_key";

-- DropIndex
DROP INDEX "StudentDanceQualification_studentId_danceType_key";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "danceType";

-- AlterTable
ALTER TABLE "DanceStyle" DROP COLUMN "legacyDanceType";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "danceType",
ALTER COLUMN "danceStyleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentDanceQualification" DROP COLUMN "danceType",
ALTER COLUMN "danceStyleId" SET NOT NULL;

-- DropEnum
DROP TYPE "DanceType";

-- AddForeignKey
ALTER TABLE "StudentDanceQualification" ADD CONSTRAINT "StudentDanceQualification_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

