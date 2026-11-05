# 22 丁丁 2026-11-05 定案的一批小決定

Status: resolved
Type: task

1. 保管人可以記**自己付的**支出與次數包（`payerUserId`／付款人＝自己）；記別人付的、改規則、設定、結算仍要 canSettle。UI 上保管人看得到「記支出」「買次數包」，付款人固定是自己。
2. 付款人可以取消**自己按的**「已完成轉帳」；別人按的不行；canSettle 什麼都能取消。
3. 開帳清單「場地」步驟：加「這間教室不用場地費」勾選，勾了就算完成（存在 Classroom 上）。
4. 學生頁確認收款／買卡（沒有課程脈絡）：非保管人一定要選收款人才能送出（維持 16 的行為）。
5. 未付款的卡（沒有賣卡分部）在首頁「要處理的事」：歸到第一次使用那張卡的課的分部；還沒用過才所有分部都顯示。
6. 「要收錢」的待處理（未付卡、未付單堂、沒綁卡）依**上課地點**（`Lesson.locationId`）過濾；錢的報表（瀑布、結算單各分部）依基金。
7. 開帳「改記到保管人」那一步也包含上線前的卡：收款人不是保管人、而且還有剩格的。
8. 分部核對提醒：每月 1 號起出現在「要處理的事」（上個月、未結算、負責人還沒核對），過了 5 號標「逾期」。
9. 老師身分拿掉「都是」，只留「老師」「助教」；資料遷移 both → teacher。
10. 課程頁「體驗名單」報名已付款時，也要收款人選擇（財務開啟時），API 接受 `receiverUserId`。
11. 首頁瀑布「還沒分帳」「過期收入與調整」兩行保留。（不用改）
12. 開帳清單付款人那一步：付款人是某成員、而那位成員在老師名單裡有同名但沒連帳號的老師（或付款人＝自己但老師沒連帳號）→ 提醒「這位老師是 X 本人嗎？連結帳號」，可一鍵連結。

## Answer

1. `assertCanRecordPayment`（`service/finance/access.ts`）：保管人可記自己付的支出／新次數包，別人付的、開帳的舊包仍要 canSettle（403 `NOT_FINANCE`）。收支頁保管人看得到「記支出」「買次數包」，表單付款人固定是自己。
2. `DELETE /api/finance/transfers/[id]`：`fromUserId` 與 `createdById` 都是自己才能取消，否則 403 `NOT_PAYER`；canSettle 都能。結算單與收支頁的「取消」照這個顯示。
3. `Classroom.financeNoVenueFee`（migration `20261105120000_no_venue_fee_and_drop_teacher_both`），`PATCH /api/finance/settings { noVenueFee }`；開帳清單場地那一步與財務設定的場地區都有勾選。
4. 已經是 16 的行為（沒有課程脈絡 → 非保管人 `RECEIVER_REQUIRED`、UI 擋送出），補了回歸測試。
5／6. `getFinanceHome`：未付款的卡用第一次用那張卡的課的上課地點，沒用過 → `null`；未付單堂、沒綁卡改依 `Lesson.locationId`；其他待辦與瀑布照舊依基金。
7. 「改記到保管人」也列上線前、收款人不是保管人、還開著且有剩格的卡；文案改成不只上線後。
8. `unreviewedBranchesFor`：1 號起列出、`overdue = 台北日 > 5`，首頁標「逾期」。
9. 同一個 migration：`BOTH → TEACHER`，enum 拿掉 `BOTH`；表單只剩老師／助教。
10. `registerTrialSchema` 加 `receiverUserId`（財務開啟、當場收款才用，必須是保管人，建學生前先驗）；體驗名單登記抽屜加收款人選單。
11. 不用改。
12. `GET /api/finance/teachers` 回 `linkSuggestion`（付款人同名、老師沒連帳號、付款人可連老師且還沒連別的）；`POST /api/finance/teachers/[id]/link` 一鍵連結；開帳清單付款人那一步與財務設定的老師付款人都顯示「老師「X」是 X 本人嗎？［連結帳號］」。只做「付款人同名」的比對——「付款人＝自己但老師沒連帳號」解讀為同一件事（付款人就是那位老師本人），沒有另外的名字不同的猜測。
