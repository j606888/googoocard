-- 開帳清單「場地」：這間教室不用場地費。
ALTER TABLE "Classroom" ADD COLUMN "financeNoVenueFee" BOOLEAN NOT NULL DEFAULT false;

-- 老師身分拿掉「都是」：BOTH → TEACHER（backfill 在改型別之前）。
UPDATE "Teacher" SET "kind" = 'TEACHER' WHERE "kind" = 'BOTH';

CREATE TYPE "TeacherKind_new" AS ENUM ('TEACHER', 'ASSISTANT');
ALTER TABLE "Teacher" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Teacher" ALTER COLUMN "kind" TYPE "TeacherKind_new" USING ("kind"::text::"TeacherKind_new");
ALTER TYPE "TeacherKind" RENAME TO "TeacherKind_old";
ALTER TYPE "TeacherKind_new" RENAME TO "TeacherKind";
DROP TYPE "TeacherKind_old";
ALTER TABLE "Teacher" ALTER COLUMN "kind" SET DEFAULT 'TEACHER';
