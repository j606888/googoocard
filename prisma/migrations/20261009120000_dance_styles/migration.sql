-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "danceStyleId" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "danceStyleId" INTEGER;

-- AlterTable
ALTER TABLE "StudentDanceQualification" ADD COLUMN     "danceStyleId" INTEGER,
ALTER COLUMN "danceType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DanceStyle" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "hasLevels" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "legacyDanceType" "DanceType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DanceStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DanceStyle_classroomId_name_key" ON "DanceStyle"("classroomId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DanceStyle_classroomId_legacyDanceType_key" ON "DanceStyle"("classroomId", "legacyDanceType");

-- CreateIndex
CREATE INDEX "Card_danceStyleId_idx" ON "Card"("danceStyleId");

-- CreateIndex
CREATE INDEX "Lesson_danceStyleId_idx" ON "Lesson"("danceStyleId");

-- CreateIndex
CREATE INDEX "StudentDanceQualification_danceStyleId_idx" ON "StudentDanceQualification"("danceStyleId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDanceQualification_studentId_danceStyleId_key" ON "StudentDanceQualification"("studentId", "danceStyleId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDanceQualification" ADD CONSTRAINT "StudentDanceQualification_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanceStyle" ADD CONSTRAINT "DanceStyle_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===========================================================================
-- BACKFILL: legacy DanceType enum -> per-classroom DanceStyle rows.
--
-- Re-runnable: the contract migration repeats this block verbatim to pick up
-- rows the old code wrote after this migration shipped. Every step only
-- touches rows whose danceStyleId is still NULL, matches styles by
-- legacyDanceType (not by name, which a classroom may have changed), and never
-- updates an existing style's settings. tests/api/dance-style-backfill.test.ts
-- runs the text between the BEGIN/END markers, one statement per `;`.
-- ===========================================================================
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
