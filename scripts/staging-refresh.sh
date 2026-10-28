#!/usr/bin/env bash
# 把正式資料庫複製到 staging（每天由 .github/workflows/staging-refresh.yml 跑，也可以手動跑）。
#
#   PROD_READONLY_DATABASE_URL  正式 RDS 的唯讀帳號（scripts/staging-refresh-setup.sh 建的）
#   STAGING_DATABASE_URL        staging Neon 的「直連」網址（unpooled，不是 -pooler）
#   STAGING_KEEP_LINE_USER_IDS  要保留 LINE 綁定的 LINE userId，逗號分隔（丁丁、Sean）
#
# 之後要再跑 `prisma migrate deploy`（用 staging 分支的 migration），workflow 會接著做。
# 需要 pg_dump／pg_restore／psql 17 以上。
set -euo pipefail

: "${PROD_READONLY_DATABASE_URL:?}"
: "${STAGING_DATABASE_URL:?}"
KEEP="${STAGING_KEEP_LINE_USER_IDS:-}"

host() { sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#' <<<"$1"; }
SRC_HOST=$(host "$PROD_READONLY_DATABASE_URL")
DST_HOST=$(host "$STAGING_DATABASE_URL")

# 安全檢查：寫入的對象一定要是 Neon（或明確允許的本機測試庫），而且不能跟來源同一台。
if [[ "$DST_HOST" == "$SRC_HOST" ]]; then
  echo "✋ 來源和目標是同一台（${DST_HOST}），不跑。" >&2; exit 1
fi
if [[ "$DST_HOST" != *.neon.tech && "${ALLOW_LOCAL_TARGET:-}" != "1" ]]; then
  echo "✋ 目標不是 Neon（${DST_HOST}），不跑。" >&2; exit 1
fi
if [[ "$DST_HOST" == *rds.amazonaws.com ]]; then
  echo "✋ 目標是 RDS，絕對不跑。" >&2; exit 1
fi

DUMP=$(mktemp -t googoocard-prod.XXXXXX)
trap 'rm -f "$DUMP"' EXIT

echo "▶ dump  $SRC_HOST"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$PROD_READONLY_DATABASE_URL"

echo "▶ reset $DST_HOST"
psql "$STAGING_DATABASE_URL" -q -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "▶ restore"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$STAGING_DATABASE_URL" "$DUMP"

echo "▶ sanitize"
psql "$STAGING_DATABASE_URL" -q -v ON_ERROR_STOP=1 -v keep_line_ids="$KEEP" -f "$(dirname "$0")/staging-sanitize.sql"

echo "✓ staging 已複製正式資料（接著跑 prisma migrate deploy）"
