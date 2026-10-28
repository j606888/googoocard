#!/usr/bin/env bash
# 把正式資料庫的資料倒進本機 docker Postgres（:54330）。本機原本的資料會先備份到 ~/googoocard-backups/。
#
#   bash scripts/local-from-prod.sh
#
# 做法：本機 schema 整個砍掉 → 用目前分支的 migration 重建（prisma migrate deploy）→
# 從正式環境只抓「資料」（pg_dump --data-only，正式只會被讀）灌進來 → 跟 staging 一樣消毒。
# 只抓資料是因為本機是 Postgres 10、正式是 16，整份 dump 還原不回去；分支的 migration 比 main 多的
# 都只是新增表，所以正式的資料一定放得進來。
#
# 消毒（scripts/staging-sanitize.sql）：推播 token 全清、Apple refresh token 清掉、LINE 綁定全清
# ——本機 .env 放的是真的 Googoocard OA token，留著綁定就可能從本機發 LINE 給真的學生。
# 要留自己的綁定：KEEP_LINE_USER_IDS=Uxxx,Uyyy bash scripts/local-from-prod.sh
# 登入用正式環境的密碼。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

env_url() { grep -E '^DATABASE_URL=' "$1" | head -1 | sed -E 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//'; }
SRC_URL="${PROD_DATABASE_URL:-$(env_url .env.production)}"
LOCAL_URL="$(env_url .env)"
CONTAINER="$(docker ps -qf publish=54330)"

# 安全檢查：寫入的一定是本機，來源一定不是本機。
if [[ ! "$LOCAL_URL" =~ @(localhost|127\.0\.0\.1): ]]; then
  echo "✋ .env 的 DATABASE_URL 不是本機，不跑。" >&2; exit 1
fi
if [[ -z "$SRC_URL" || "$SRC_URL" =~ @(localhost|127\.0\.0\.1): ]]; then
  echo "✋ 找不到正式環境的網址（.env.production）。" >&2; exit 1
fi
if [[ -z "$CONTAINER" ]]; then
  echo "✋ 本機 Postgres 沒開（docker-compose up -d）。" >&2; exit 1
fi
DBNAME="$(sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#' <<<"$LOCAL_URL")"
local_psql() { docker exec -i "$CONTAINER" psql -U postgres -d "${DBNAME}" -q -v ON_ERROR_STOP=1 "$@"; }

echo "▶ 來源  $(sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#' <<<"$SRC_URL")（只讀）"
echo "▶ 目標  本機 ${DBNAME}（會整個換掉）"
if [[ -t 0 ]]; then
  read -r -p "確定？[y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

mkdir -p ~/googoocard-backups
BACKUP=~/googoocard-backups/local-$(date +%Y%m%d-%H%M%S).dump
echo "▶ 備份本機 → ${BACKUP}"
docker exec "$CONTAINER" pg_dump -U postgres -Fc "${DBNAME}" > "$BACKUP"

echo "▶ 重建本機 schema（目前分支的 migration）"
local_psql -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
DATABASE_URL="$LOCAL_URL" npx prisma migrate deploy >/dev/null

echo "▶ 從正式環境抓資料、灌進本機"
# pg_dump 用 16 版（跟正式一樣）；session_replication_role 讓灌資料時先不檢查外鍵順序
# （所以 pg_dump 警告的循環外鍵沒關係）。新版 pg_dump 會印 \restrict，本機的 psql 10 看不懂，濾掉。
{
  echo "SET session_replication_role = replica;"
  docker run --rm -i postgres:16 pg_dump --data-only --no-owner --no-privileges \
    --exclude-table='"_prisma_migrations"' "$SRC_URL" \
    | grep -v -E '^(SET (transaction_timeout|default_table_access_method)|\\(un)?restrict )'
} | local_psql

echo "▶ 消毒"
local_psql -v keep_line_ids="${KEEP_LINE_USER_IDS:-}" < scripts/staging-sanitize.sql
local_psql -c 'DROP TABLE "_StagingInfo";'  # staging 專用，留著 migrate dev 會以為 schema 飄了

echo "✓ 本機已換成正式資料（舊的在 ${BACKUP}，還原：docker exec -i $CONTAINER pg_restore -U postgres -d ${DBNAME} --clean < 備份檔）"
