-- staging 複製完的消毒（scripts/staging-refresh.sh 呼叫）。資料是正式環境的，所以：
--  1. 推播 token 全清：staging 一律不發推播（src/lib/appEnv.ts），這是第二道保險。
--  2. Apple 的 refresh token 是秘密，清掉。
--  3. 學生的 LINE 綁定只留 :keep_line_ids 這幾個（丁丁、Sean），其他全清——
--     測試 LINE 官方帳號跟正式的在同一個 provider，userId 是通的。
-- psql 變數 keep_line_ids：逗號分隔的 LINE userId，可以是空字串。

\set ON_ERROR_STOP on
BEGIN;

TRUNCATE "PushToken", "WebPushSubscription";

UPDATE "User" SET "appleRefreshToken" = NULL, "appleClientId" = NULL WHERE "appleRefreshToken" IS NOT NULL;

CREATE TEMP TABLE keep_line AS
  SELECT trim(x) AS id FROM unnest(string_to_array(:'keep_line_ids', ',')) AS x WHERE trim(x) <> '';

UPDATE "Student" SET "lineUserId" = NULL
  WHERE "lineUserId" IS NOT NULL AND "lineUserId" NOT IN (SELECT id FROM keep_line);
UPDATE "User" SET "lineUserId" = NULL
  WHERE "lineUserId" IS NOT NULL AND "lineUserId" NOT IN (SELECT id FROM keep_line);
DELETE FROM "LineAccount" WHERE "lineUserId" NOT IN (SELECT id FROM keep_line);

-- 給畫面上的「測試環境 · 幾月幾日從正式環境複製」（src/app/api/staging-info）。不在 Prisma schema 裡。
CREATE TABLE IF NOT EXISTS "_StagingInfo" (refreshed_at timestamptz NOT NULL);
TRUNCATE "_StagingInfo";
INSERT INTO "_StagingInfo" VALUES (now());

COMMIT;
