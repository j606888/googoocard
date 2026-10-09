-- Re-run of the dance_styles backfill, shipped with the code that switches to
-- danceStyleId. The old code kept writing enum-only rows (danceStyleId NULL)
-- after 20261009120000_dance_styles was deployed; apply this right before the
-- new code goes live so it never sees them. The contract migration runs the
-- block once more. The block is a verbatim copy — tests/api/dance-style-backfill
-- .test.ts checks that it stays identical.

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
