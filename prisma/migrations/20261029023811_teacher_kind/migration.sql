-- CreateEnum
CREATE TYPE "TeacherKind" AS ENUM ('TEACHER', 'ASSISTANT', 'BOTH');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "kind" "TeacherKind" NOT NULL DEFAULT 'TEACHER';

-- 舊資料：只當助教的 → ASSISTANT；其他人維持原本「選助教時也列得出來」→ BOTH。
-- 之後新增的老師預設 TEACHER（只教課）。
UPDATE "Teacher" SET "kind" = CASE WHEN "isAssistant" THEN 'ASSISTANT'::"TeacherKind" ELSE 'BOTH'::"TeacherKind" END;

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "isAssistant";
