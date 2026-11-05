# 21 修 workflow 審查找到的問題

Status: ready-for-agent
Type: task

2026-11-05 審查 `c62d1d1..cc40143` 找到的（檔案行號是當時的）：
1. `src/service/finance/branchReview.ts:30` 雜湊用 `JSON.stringify(payee)`，鎖月後快照從 jsonb 讀回來 key 順序不同 → 結算後核對永遠變「核對後有變動」。改成固定 key 順序／排序後再 hash；加「核對 → 結算 → 仍有效」的測試。
3. `src/app/api/finance/members/[userId]/route.ts` 取消 isCustodian 時，若他仍是 `Location.keeperUserId`／`expiryUserId`、`Teacher.payerUserId`、`Venue.landlordUserId` → 409 並說明是哪些，不要留下壞參照。
4. `src/service/finance/setup.ts`、`settings/route.ts`：舊卡保管人（`legacyCustodianUserId`）必須是保管人。
5. `DropInForm.tsx` $0 單堂（免收）：不需要收款人，伺服器端不要要求 `receiverUserId`／不要因 `defaultReceiver` 失敗而 400。
6. `src/service/finance/settlement.ts` 付款人「已完成」的「不超過未付金額」檢查要在交易內＋鎖（或唯一約束），連按兩下不能記兩筆。
7. `branchReview.ts` 核對雜湊不要包含取整零頭（或只算該分部自己的），週日課的變動不該取消台南的核對。
