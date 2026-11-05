# 04 `isFinance` 拆成「保管人」和「可以結算」

Status: ready-for-agent
Type: task

Parent: `.scratch/finance/spec.md`（「人」一節）

`Membership.isFinance` 現在同時代表保管人和財務權限（spec §8「財務＝保管人」）。拆成兩個欄位（例：`isCustodian`、`canSettle`），migration 把現有 `isFinance = true` 兩個都設 true。
- 保管人：出現在保管中、可被選為收款人、分部負責人必須是保管人、核對自己的分部。
- 可以結算：確認結算、代按已完成轉帳、記支出／次數包、改分帳規則與財務設定、開帳。
- 逐一檢查約 20 個用到 `isFinance` 的檔案，決定各自是哪一種。「最後一位財務」守門改成各自的守門。
- 成員設定 UI 兩個勾。

驗收：丁丁兩個都勾、Sean 只勾保管人時，Sean 不能結算但能被選為收款人；只勾可以結算的人不出現在保管中。
