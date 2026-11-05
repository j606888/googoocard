# 12 合併、db:deploy、上線

Status: ready-for-human
Type: task
Blocked by: 11

合併 `feat/finance` → `main`，`npm run db:deploy`，正式環境開財務（上線日＝當天，第一期到月底），照 11 的答案開帳。staging 放回 main（`git push origin main:staging -f`）。更新 `docs/roadmap.md`、`docs/architecture.md`「財務」。
