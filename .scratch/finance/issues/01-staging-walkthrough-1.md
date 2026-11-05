# 01 在 staging 走一遍十一月劇本（現有版本）

Status: resolved
Type: task

Parent: `.scratch/finance/spec.md`

- `gh variable set STAGING_REFRESH_PAUSED --body true`，`git push origin feat/finance:staging -f`。
- 照 spec §14「模擬一個月：十一月」從開帳清單點到月結、已轉；每個財務頁都用手機寬度看一次。
- Claude 操作瀏覽器、截圖；丁丁判斷對不對、看不看得懂。
- 發現的碎片各開一張 ticket，插在 02～09 之間。
- 走完：恢復刷新（`--body false`），staging 放回 main 前先確認 10 號要不要接著用。

## Answer
2026-11-05 在 staging 走完開帳＋台南一個月（兩堂、單堂、未付卡、待定、跨分部用卡、廣告支出）。結算單數字全部手算核對正確。碎片開成 13～20；週日課的決定見 spec「週日課（高雄老師在台南上）」。高雄 11/5 Bachata training 還沒點（當天 20:30），第二遍再驗高雄次數包扣次。
