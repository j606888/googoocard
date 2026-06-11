-- 1. Create StudentDanceQualification table
CREATE TABLE "StudentDanceQualification" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "danceType" "DanceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDanceQualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentDanceQualification_studentId_danceType_key"
    ON "StudentDanceQualification"("studentId", "danceType");

ALTER TABLE "StudentDanceQualification"
    ADD CONSTRAINT "StudentDanceQualification_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Backfill qualifications from the legacy boolean flags (must run before the column drops)
INSERT INTO "StudentDanceQualification" ("studentId", "danceType")
    SELECT "id", 'BACHATA'::"DanceType" FROM "Student" WHERE "hasCompletedBachataLv1" = true;

INSERT INTO "StudentDanceQualification" ("studentId", "danceType")
    SELECT "id", 'SALSA'::"DanceType" FROM "Student" WHERE "hasCompletedSalsaLv1" = true;

-- 3. Drop the legacy boolean flags
ALTER TABLE "Student" DROP COLUMN "hasCompletedBachataLv1";
ALTER TABLE "Student" DROP COLUMN "hasCompletedSalsaLv1";

-- 4. Add Card.danceType (nullable; required for practice cards at app level)
ALTER TABLE "Card" ADD COLUMN "danceType" "DanceType";

-- 5. Backfill practice-card danceType from linked lessons, only when unambiguous
--    (every linked lesson has the same danceType). Cards with no linked lesson or
--    mixed dance types stay NULL and are surfaced in the UI for manual fix.
UPDATE "Card" c
SET "danceType" = sub."danceType"
FROM (
    SELECT lc."cardId", MIN(l."danceType"::text)::"DanceType" AS "danceType"
    FROM "LessonCard" lc
    JOIN "Lesson" l ON l."id" = lc."lessonId"
    GROUP BY lc."cardId"
    HAVING COUNT(DISTINCT l."danceType") = 1
) sub
WHERE c."id" = sub."cardId" AND c."isPracticeCard" = true;
