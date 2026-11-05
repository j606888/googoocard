# 21 修 workflow 審查找到的問題

Status: resolved
Type: task

2026-11-05 審查 `c62d1d1..cc40143` 找到的（檔案行號是當時的）：
1. `src/service/finance/branchReview.ts:30` 雜湊用 `JSON.stringify(payee)`，鎖月後快照從 jsonb 讀回來 key 順序不同 → 結算後核對永遠變「核對後有變動」。改成固定 key 順序／排序後再 hash；加「核對 → 結算 → 仍有效」的測試。
3. `src/app/api/finance/members/[userId]/route.ts` 取消 isCustodian 時，若他仍是 `Location.keeperUserId`／`expiryUserId`、`Teacher.payerUserId`、`Venue.landlordUserId` → 409 並說明是哪些，不要留下壞參照。
4. `src/service/finance/setup.ts`、`settings/route.ts`：舊卡保管人（`legacyCustodianUserId`）必須是保管人。
5. `DropInForm.tsx` $0 單堂（免收）：不需要收款人，伺服器端不要要求 `receiverUserId`／不要因 `defaultReceiver` 失敗而 400。
6. `src/service/finance/settlement.ts` 付款人「已完成」的「不超過未付金額」檢查要在交易內＋鎖（或唯一約束），連按兩下不能記兩筆。
7. `branchReview.ts` 核對雜湊不要包含取整零頭（或只算該分部自己的），週日課的變動不該取消台南的核對。

## Answer

- 1／7：`branchHash` 改用固定 key 順序的序列化（`stableStringify`），`byBranch` 只雜湊營收與支出（`fundChange` 含取整零頭，其他組成本來就各自在雜湊裡），另補上該分部的過期收入調整。測試：核對 → 結算 → 仍有效（含場地包 payee）、取整零頭不會因週日課取消台南核對。
- 3：取消保管人時若他還是分部負責人／過期收入對象（`expiryTo = USER`）／老師付款人／房東／舊卡保管人（只看沒封存的）→ 409 `CUSTODIAN_IN_USE`，訊息列出是哪些，UI 直接顯示。
- 4：`PATCH /api/finance/settings` 的舊卡保管人必須是保管人（400 `NOT_FINANCE_MEMBER`），下拉只列保管人；開財務時選的舊卡保管人自動勾成保管人（不勾可以結算）。
- 5：財務開啟、$0 單堂（記單堂與確認收款）沒指定收款人 → 不找預設收款人、記 `paidByUserId = null`。
- 6：`POST /api/finance/transfers` 的檢查與寫入同一個交易，非結算者先 `FOR UPDATE` 鎖住那個月的 `FinanceSettlement`；三連按只記一筆。
