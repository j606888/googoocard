# 學生 LINE 綁定身分 → 自助簽到 → 自助購卡對帳（規劃討論稿 / LINE Bot 版）

> 狀態：**討論中（尚未開發）**。本文記錄方向決策、分階段藍圖、與待細談的開放問題。
> 註：本版已將原「網頁 Google OAuth」方向整個替換為 **LINE Bot（Messaging API）+ LIFF**。

## 背景（為什麼做）

教室（10–20 人規模）兩個營運痛點，都源自「系統只給老師/小幫手用、學生沒有身分入口」：

1. **點名繁瑣**：小幫手現場逐一勾選，遇到不認識的人、第一次來的、點完才到的遲到者都要補。希望學生自己簽到，小幫手只處理例外。
2. **金流對帳困難**：收錢（現金/轉帳/Line Pay）跟開卡分離——學生私訊喬開卡、上課才發現沒卡要現場收，全靠人工記憶對帳。希望學生事先自助購卡、自己看剩幾堂。

**為什麼是 LINE 而不是網頁登入**：南部學員幾乎只用 LINE，註冊/密碼/網頁登入都是摩擦。改用 LINE 官方帳號 + 圖文選單（Rich Menu）+ LIFF，學員「終身綁一次、之後點圖文選單即用」，達到零摩擦、免註冊。

## 已確認方向

| 議題 | 決策 |
|---|---|
| 學生身分入口 | **LINE 官方帳號（Messaging API）+ LIFF**，捨棄網頁 Google 登入 |
| 身分驗證 | LIFF 取得 **LINE ID Token**，後端驗證後取 `sub` = LINE UID，反查 `Student`；學生**無帳號/無密碼/無 cookie** |
| 帳號對應 Student | `Student.lineUserId`（**非唯一**）；一個 LINE UID 可對多個 Student（家長多孩、跨教室），多筆時 LIFF 先選身分 |
| 綁定方式 | 學生加入官方帳號後，**輸入專屬 `randomKey`** 或**點帶 `randomKey` 的連結**，把 LINE UID 死死綁到現有 `Student`，終身僅綁一次 |
| 金流 | **先只做對帳，不串第三方金流**；用「訂單 + 狀態 + 轉帳末五碼」取代私訊喬卡 |
| 信任開卡 | 購卡即**真的建一張 `StudentCard`**（帶「尚未核銷」標記，可正常扣堂）；收款人後台按「標記為付款完成」轉正 |
| 建造順序 | **Phase 1 LINE 綁定身分 → Phase 2 LIFF 自助簽到 → Phase 3 自助購卡對帳**，每段可獨立上線 |

> 設計原則：盡量重用既有 attendance / qualification / `createStudentCard` 邏輯；`StudentCard` 仍是營收唯一真實來源（但 income 需排除「尚未核銷」卡，見下）。

---

## 現況關鍵事實（探索結論）

- repo **目前完全沒有** LINE / webhook / LIFF / 推播 / 檔案上傳（S3/R2）任何程式碼——全部全新建置。
- Auth 是自製 JWT 存 httpOnly cookie（`src/lib/auth.ts`），供**老師/小幫手**用；**學生不走這套**，改以 LIFF ID Token 逐次驗證。
- Middleware（`src/middleware.ts`）公開路由已含 `/api` 與 `/public-students`；LINE webhook / LIFF 用的新 API 落在 `/api` 之下天然公開，無需動 middleware 的學生阻擋邏輯（學生本來就不進老師頁）。
- `/api/public-students/[randomKey]/route.ts` 已**免登入**組好學生完整檢視（overview、studentCards 餘額、出席、danceQualifications）→ 可派生成 LIFF 首頁資料源（改以 `lineUserId`+`studentId` 解析）。
- 點名：卡片自動挑選 / pending 機制已存在（`selectStudentCard`、`takeAttendance`、`uncheckedType`，UI `PendingStudents.tsx`）。`LessonPeriod.attendanceTakenAt` 一蓋章定案。
- 開卡：`POST /api/students/[id]/student-cards` 只建 `StudentCard` + Event「購買課卡」+ `refreshNeedsRenewalTag()`。
- 營收：`src/lib/income.ts` 把**每張 `StudentCard`** 計入（`finalPrice / totalSessions`，只算綁卡出席）。→ 信任開卡需在此**過濾未核銷卡**，否則營收灌水。

---

## Phase 1 — 學生 LINE 綁定身分

**Schema（`prisma/schema.prisma` + migration）**
- `Student` 新增 `lineUserId String?`（**不加 `@unique`**，加一般 index）。一個 LINE UID 可綁多個 Student。
- **不動** `User`：不加 `googleSub`、不改 `password`。學生不是 `User`。

**LINE 平台設定（一次性）**
- 建 **Messaging API channel**（官方帳號）：取得 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`。
- 在同 provider 下建 **LIFF app**：取得 `LINE_LIFF_ID`（公開）；ID Token 的 `aud` = LINE Login channel id（`LINE_LOGIN_CHANNEL_ID`）。
- 新 env：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`NEXT_PUBLIC_LINE_LIFF_ID`、`LINE_LOGIN_CHANNEL_ID`。

**身分驗證機制（取代 JWT cookie）**
- 前端 LIFF：`liff.init()` → `liff.getIDToken()`，呼叫後端 API 時帶在 `Authorization: Bearer <idToken>`。
- 後端新 helper `resolveStudentsFromLineToken(idToken)`：向 LINE 驗證 ID Token（`https://api.line.me/oauth2/v2.1/verify`，比對 `aud`）→ 取 `sub`(=lineUserId) → 反查該教室所有 `Student`。多筆時要求請求帶 `studentId`，並驗證該 student 的 `lineUserId` 等於 token 的 sub（防越權）。

**綁定流程**
- 老師端：在 `src/features/students/StudentDetail/BasicSection/index.tsx`（現有分享 URL 處）加「邀請學生綁定 LINE」，產生提示文字 / 帶 `randomKey` 的 LINE 加好友連結。
- 學生端二選一（建議兩者都支援）：
  1. **Webhook 文字綁定**：學生加官方帳號後輸入 `randomKey` →（見下方 webhook）找到 `Student` 把 `lineUserId` 寫上 → 回覆綁定成功。
  2. **LIFF 連結綁定**：連結帶 `?randomKey=` 進 LIFF → 取 ID Token → 後端把該 `Student.lineUserId = sub`。
- 已被同人綁定 → 視為已綁，回覆其身分；不同人想搶綁 → 擋下並說明（同一 `Student` 一旦綁定，需老師後台解綁才能換）。

**LINE Webhook**
- 新 `POST /api/line/webhook`（公開，落在 `/api`）：先用 `LINE_CHANNEL_SECRET` 驗 `X-Line-Signature`（HMAC-SHA256）→ 解析 events：
  - `message`(text) 且內容像 `randomKey` → 執行綁定。
  - 其他訊息 → 回覆引導文字 / 圖文選單提示。

---

## Phase 2 — 學生自助簽到（LIFF + 圖文選單）

**Schema**：`LessonPeriod` 新增 `checkInOpenedAt DateTime?`（老師對當前時段「開啟簽到」；`attendanceTakenAt` 仍作最終定案）。

**圖文選單（Rich Menu）作為學員後台**：固定三鍵
- 【今日簽到】→ 開 LIFF → 呼叫 self-checkin。
- 【我的課卡】→ 開 LIFF → 讀餘額 / 出席。
- 【購買課卡】→ 開 LIFF → 下單（Phase 3）。

**LIFF 首頁（我的課卡）**：派生自 `public-students` 組裝邏輯，但以 `lineUserId`(+多筆時選定 `studentId`) 解析。新 `GET /api/liff/me`（auth = ID Token）回傳同 `public-students` 形狀的資料。

**自助簽到 API**：`POST /api/liff/self-checkin`（auth = ID Token）
- 由 token 反查 `Student`（多筆要帶 `studentId`）→ 依其教室找「`checkInOpenedAt` 開著且在時段內」的 `LessonPeriod`。
- 建 `AttendanceRecord`，**重用 `selectStudentCard`**：單卡明確就自動扣，無卡/多卡留 `uncheckedType` 給小幫手；**做去重**（同 student+period 已存在則不重建）。
- **不**在自助簽到時設 `attendanceTakenAt`；最終由老師 finalize。

**老師端**：重用 `CheckPeriod` / `PendingStudents.tsx` 看誰已自助簽到、解 pending、補新人、finalize（設 `attendanceTakenAt`，沿用 `takeAttendance`/`updateAttendance`）。需確認 finalize 不會重複建立學生已自助簽到的紀錄（以既有紀錄為準，只補蓋章與解 pending）。

**主動推播（卡片用盡催續）**：在 `processStudentCardUsage` 觸發「課卡使用完畢」Event 之處，加一個「若該 `Student.lineUserId` 存在 → 呼叫 LINE Push」的 hook（`POST https://api.line.me/v2/bot/message/push`，帶 `LINE_CHANNEL_ACCESS_TOKEN`）。推播失敗不可影響扣堂主流程（try/catch、可非同步）。

---

## Phase 3 — 自助購卡 + 信任開卡 + 轉帳對帳（不串金流）

**Schema**
- 新增 `CardOrder`：`studentId`、`cardId`、`sessions`、`price`、`status`(`pending_review` / `confirmed` / `rejected` / `cancelled`)、`referenceCode`(轉帳末五碼)、`screenshotUrl String?`（預留，首版不做上傳）、`confirmedByUserId Int?`、`resultingStudentCardId Int?`、時間戳。
- `StudentCard` 新增「尚未核銷」標記：建議 `paymentStatus`（`unconfirmed` / `confirmed`）或 `confirmedAt DateTime?`。預設新自助購卡為 `unconfirmed`；老師/小幫手手動現場開卡可直接 `confirmed`。

**信任開卡流程（核心營運邏輯）**
1. 學員在 LIFF【購買課卡】選教室提供的卡（**重用 `canBuyCard`** 擋未資格者買複習卡）→ 建 `CardOrder(pending_review)`，並**同時直接建立一張 `StudentCard`（標記 unconfirmed）**、回填 `resultingStudentCardId`。Event 記「購買課卡（待核銷）」。
2. 此卡**可正常被簽到扣堂**（attendance / `selectStudentCard` 完全不需改），確保課堂現場不卡關。
3. 學員轉帳後在 LIFF 填末五碼 `referenceCode`（截圖之後再補）。
4. 收款人於後台卡片清單看到該卡的「尚未核銷」標記 → 對銀行帳單核對末五碼 → 按 **「標記為付款完成」** → `StudentCard` 轉 `confirmed`、`CardOrder` 轉 `confirmed`+`confirmedByUserId`。
5. 若拒絕：`CardOrder=rejected`，該 `StudentCard` 作廢（軟刪/停用）；**若已被扣過堂，需處理已消耗堂數**（見開放問題）。

**營收（重要）**：`src/lib/income.ts` 需**排除 `unconfirmed` 的 `StudentCard`**（單點 filter），避免未收到的錢灌水營收；確認後自動計入。→ 原則「`StudentCard` 是唯一營收來源」不變，但「income.ts 不動」改為「income.ts 加一個未核銷過濾」。

**重用**：開卡沿用 `createStudentCard`（`POST /api/students/[id]/student-cards`）的 row 建立 + Event + `refreshNeedsRenewalTag()`，只多帶 `paymentStatus=unconfirmed` 與 `orderId`。

---

## 跨階段注意
- Schema 變更走 `npm run db:migrate`（嚴禁 `db push` / `migrate reset`）；部署 `npm run db:deploy`。
- 資格判斷一律走 `src/domains/qualification/index.ts`，勿在他處硬寫 dance-type 檢查。
- LINE webhook 必驗 `X-Line-Signature`；LIFF API 必驗 ID Token 並做「學生只能操作自己 Student（`lineUserId` 比對）」授權。
- 推播/外呼 LINE 一律包 try/catch，不得阻斷扣堂/開卡主流程；access token 等機密只放後端 env，`NEXT_PUBLIC_` 僅放 LIFF ID。
- 整合測試延用 `tests/api` 模式（factories + 測試 DB）；LINE 外部呼叫以 mock 取代。

---

## 待細談的開放問題（下次討論）

**LINE 綁定 / 身分**
1. `randomKey` 同時是公開唯讀連結又是綁定權杖，安全嗎？要不要另發一次性、可過期的綁定碼？
2. 一個 LINE UID 對多個 Student 時，LIFF 的「選身分」UX 怎麼設計？預設記住上次選的？
3. 換手機 / 封鎖再加好友 → `lineUserId` 會變嗎？要不要提供老師端「解綁/重綁」？
4. 學生退出官方帳號（unfollow）webhook 要不要清狀態 / 標記？

**自助簽到**
5. 「目前進行中的 period」判定：靠老師手動「開啟簽到」、還是純用時段時間自動判定？同時段多堂課怎麼辦？
6. 自助簽到當下就扣堂，還是等老師 finalize？無卡學生自助簽到後擋下還是給「請購卡」提示（直接導購卡）？
7. 防濫用：要不要限制只能教室現場簽到（門口短效碼 / IP / 地理），避免在家亂簽？LIFF 能否拿到可信位置？
8. 推播頻率與額度：LINE 推播有額度/成本，催續卡要不要去重、設冷卻時間？
9. 既有 `/public-students` 唯讀頁是否保留（未綁 LINE 的學生）還是收斂進 LIFF？

**購卡對帳 / 信任開卡**
10. `referenceCode` 形式（末五碼 / 隨機碼 / 金額尾數）？多筆同金額怎麼辨識？
11. **信任開卡被拒絕、但已扣過堂**：已消耗堂數怎麼處理（作廢出席紀錄歸零營收？保留並追款？凍結帳號？）。
12. 「尚未核銷」卡在 LIFF 的【我的課卡】要不要對學生顯示狀態（待確認 / 已確認）？
13. 訂單 / 未核銷卡的自動過期規則（下單沒付 N 天自動作廢）？
14. 截圖上傳何時補、存哪（R2/S3/NAS）、誰看（隱私）？
15. 折扣/改價（`basePrice` vs `finalPrice`）在自助訂單怎麼呈現給學生？保留老師現場現金直接開卡（confirmed）流程並存。

---

## 我（規劃者）額外提出、原構想未涵蓋的疑慮

- **學生無 cookie/session**：每次 LIFF 呼叫都帶 ID Token 驗證，要留意 token 時效與重簽，避免介面中途失效。
- **多 Student 越權**：一對多後，所有 self-checkin / 購卡 / 讀卡 API 都必須驗「該 studentId 的 lineUserId == token sub」，否則可代他人簽到/購卡。
- **income 語意改變**：未核銷卡不計營收（建議），但若老師長期不核銷，營收會「漏算」→ 後台要有「未核銷卡」提醒清單。
- **webhook 與 LIFF 屬不同 channel 設定**：ID Token 的 `aud`、webhook 的 `secret` 來源不同，設定容易接錯，文件需明確標註各 env 對應哪個 channel。
- **headless/cron 環境**：LINE 外呼需要網路與正式 access token，整合測試務必 mock，勿打到真實 LINE。
 