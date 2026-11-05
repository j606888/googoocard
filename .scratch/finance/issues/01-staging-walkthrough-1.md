# 01 在 staging 走一遍十一月劇本（現有版本）

Status: ready-for-human
Type: task

Parent: `.scratch/finance/spec.md`

- `gh variable set STAGING_REFRESH_PAUSED --body true`，`git push origin feat/finance:staging -f`。
- 照 spec §14「模擬一個月：十一月」從開帳清單點到月結、已轉；每個財務頁都用手機寬度看一次。
- Claude 操作瀏覽器、截圖；丁丁判斷對不對、看不看得懂。
- 發現的碎片各開一張 ticket，插在 02～09 之間。
- 走完：恢復刷新（`--body false`），staging 放回 main 前先確認 10 號要不要接著用。
