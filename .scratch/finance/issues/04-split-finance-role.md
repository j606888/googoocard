# 04 `isFinance` 拆成「保管人」和「可以結算」

Status: resolved
Type: task

Parent: `.scratch/finance/spec.md`（「人」一節）

`Membership.isFinance` 現在同時代表保管人和財務權限（spec §8「財務＝保管人」）。拆成兩個欄位（例：`isCustodian`、`canSettle`），migration 把現有 `isFinance = true` 兩個都設 true。
- 保管人：出現在保管中、可被選為收款人、分部負責人必須是保管人、核對自己的分部。
- 可以結算：確認結算、代按已完成轉帳、記支出／次數包、改分帳規則與財務設定、開帳。
- 逐一檢查約 20 個用到 `isFinance` 的檔案，決定各自是哪一種。「最後一位財務」守門改成各自的守門。
- 成員設定 UI 兩個勾。

驗收：丁丁兩個都勾、Sean 只勾保管人時，Sean 不能結算但能被選為收款人；只勾可以結算的人不出現在保管中。

## Answer
`Membership.isFinance` → `isCustodian` + `canSettle`（migration `20261105072319_split_finance_role`，舊的財務兩個都設 true）。保管人：保管中、收款人、分部負責人／付款人／過期歸屬（`assertCustodian`、`isCustodian`）；可以結算：所有財務寫入與結算（`assertCanSettle`，轉帳／退費也算）。
各自守門 `LAST_CUSTODIAN`／`LAST_SETTLER`；財務設定成員列兩個勾；驗收情境在 `tests/api/finance-enable.test.ts`。「核對自己的分部」還沒有這個功能（見 05），屆時用 `isCustodian`。
