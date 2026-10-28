#!/usr/bin/env bash
# 每日 staging 複製的一次性設定（只要跑一次；之後要換值也是重跑這支）：
#   1. 在正式 RDS 建唯讀帳號 googoocard_readonly（只能 SELECT），網址存成 GitHub secret
#   2. 貼上 staging Neon 的直連網址，存成 GitHub secret
#   3. 選要保留 LINE 綁定的人（丁丁、Sean），存成 GitHub secret
# 需要：docker（跑 psql）、gh（已登入）、.env.production 裡的正式 DATABASE_URL。
# 密碼和網址都不會印在畫面上。要在自己的終端機跑（會問你要貼網址），在哪個分支都可以：
#   bash <(git show chore/staging-refresh:scripts/staging-refresh-setup.sh)    # 還沒 merge 時
#   scripts/staging-refresh-setup.sh                                          # merge 進 main 之後
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[[ -t 0 ]] || { echo "✋ 要在自己的終端機跑（會問你問題）" >&2; exit 1; }

ADMIN=$(grep '^DATABASE_URL=' .env.production | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')
[[ -n "$ADMIN" ]] || { echo "✋ .env.production 沒有 DATABASE_URL" >&2; exit 1; }
DBNAME=$(sed -E 's#.*/([^/?]+)(\?.*)?$#\1#' <<<"$ADMIN")
psql_prod() { docker run --rm postgres:16 psql "$ADMIN" -v ON_ERROR_STOP=1 "$@"; }
psql_prod_stdin() { docker run --rm -i postgres:16 psql "$ADMIN" -v ON_ERROR_STOP=1 "$@"; }

echo "── 1/3 正式 RDS 唯讀帳號（資料庫 ${DBNAME}）"
PW=$(openssl rand -hex 24)
psql_prod_stdin -q -v pw="$PW" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'googoocard_readonly') THEN
    CREATE ROLE googoocard_readonly LOGIN;
  END IF;
END \$\$;
ALTER ROLE googoocard_readonly WITH LOGIN PASSWORD :'pw';
ALTER ROLE googoocard_readonly SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE "$DBNAME" TO googoocard_readonly;
GRANT USAGE ON SCHEMA public TO googoocard_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO googoocard_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO googoocard_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO googoocard_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO googoocard_readonly;
SQL
READONLY=$(sed -E "s#^([a-z]+://)[^@]+@#\1googoocard_readonly:${PW}@#" <<<"$ADMIN")
gh secret set PROD_READONLY_DATABASE_URL --body "$READONLY" >/dev/null
echo "✓ 唯讀帳號建好，已存成 PROD_READONLY_DATABASE_URL"

echo
echo "── 2/3 staging Neon 直連網址"
echo "   Neon 後台 → googoocard-staging → Connect → 關掉「Connection pooling」→ 複製網址（host 不能有 -pooler）"
read -r -s -p "   貼上（不會顯示）：" NEON; echo
NEON_HOST=$(sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#' <<<"$NEON")
[[ "$NEON_HOST" == *.neon.tech ]] || { echo "✋ 這不是 Neon 的網址（${NEON_HOST}）" >&2; exit 1; }
[[ "$NEON_HOST" != *-pooler* ]] || { echo "✋ 這是 pooler 網址，要直連的（關掉 Connection pooling）" >&2; exit 1; }
gh secret set STAGING_DATABASE_URL --body "$NEON" >/dev/null
echo "✓ 已存成 STAGING_DATABASE_URL"

echo
echo "── 3/3 保留誰的 LINE 綁定（其他學生的 LINE 綁定在 staging 全清）"
echo "   正式環境裡名字像丁丁／Sean 的學生："
psql_prod -At -F ' | ' -c "SELECT s.\"lineUserId\", s.name, c.name FROM \"Student\" s JOIN \"Classroom\" c ON c.id = s.\"classroomId\" WHERE s.\"lineUserId\" IS NOT NULL AND (s.name ILIKE '%丁丁%' OR s.name ILIKE '%dingding%' OR s.name ILIKE '%sean%') ORDER BY s.name;"
read -r -p "   要保留的 LINE userId（逗號分隔，可以空白）：" KEEP
gh secret set STAGING_KEEP_LINE_USER_IDS --body "${KEEP:- }" >/dev/null
echo "✓ 已存成 STAGING_KEEP_LINE_USER_IDS"

echo
echo "全部設好。手動跑一次：gh workflow run staging-refresh.yml"
