# Googoocard 體檢與藍圖

> 建立：2026-08-23（全專案掃描：21.8k 行 / 64 個 API route / 23 支整合測試）
> 前提：**production 上已有多間教室在使用**——跨教室資料邊界是實質風險，不是理論問題。

## 這份文件是什麼

| 文件 | 回答的問題 |
|---|---|
| [`architecture.md`](architecture.md) | 系統**現在是什麼**——領域模型、資格規則、點名流程、部署注意 |
| **本文** | 系統**還缺什麼、下一步做什麼**——技術債、安全缺口、功能藍圖 |
| [`design-system-audit.md`](design-system-audit.md) | 色彩 token 與元件收斂（**已全部完成**，保留作為決策紀錄） |
| [`student-login-checkin-payment-plan.md`](student-login-checkin-payment-plan.md) | LINE 綁定 → 自助簽到 → 購卡對帳的原始規劃稿（Phase 1–2 已上線，Phase 3 未做） |

**動手改任何區塊前，先在本文搜尋該檔名**，確認沒有已知未修的安全或效能問題會被你的改動放大。

格式沿用 design-system-audit 的慣例：完成的項目改成 `[x]` 並註記 `✅ 日期` 與實際做法，
**不要刪除**——保留下來就是決策紀錄。

---

# P0 — 安全性 ✅ 全數完成 2026-08-23

> 修補後：`npm run lint`（無 error）、`npm run build`、`npm test`（273 項）全綠。
> 新增回歸測試 `tests/api/api-authz.test.ts`（22 項）與 `src/lib/rateLimit.test.ts`（9 項）。
> **這批改動含 API 回應欄位的移除，部署前請確認前端沒有讀取被拿掉的欄位**
> （已檢查：`lineUserId` / `lineBindKey` / `checkinKey` 前端從未使用；
> `randomKey` 只有老師端學生詳細頁在用，該處仍保留）。

根因：`src/middleware.ts` 把整段 `/api` 列為公開路由，真正的把關全靠每個 handler
自己記得呼叫 `decodeAuthToken()`。這個約定沒有任何機制強制執行，所以會漏。

> **後續改善方向**（尚未做）：與其倚賴每個 handler 自律，不如做成預設安全——
> 例如 P1-3 的 `withApiHandler()` 包裝器預設要求 session，公開 route 必須明確 opt-out。
> 那才是真正堵住這一類漏洞的方式，本次只是把已知的洞補上。

## [x] P0-1 八個完全沒有身分驗證的 route ✅ 2026-08-23

下列 route 從未呼叫 `decodeAuthToken()`，等同對全世界公開。用遞增的整數 id 就能遍歷：

| 檔案 | 洩漏內容 |
|---|---|
| `src/app/api/students/[id]/route.ts`（GET） | 整份學生檔案：姓名、備註、消費總額、出席史、課卡 |
| `src/app/api/students/[id]/student-cards/route.ts`（GET） | 課卡餘額與價格 |
| `src/app/api/students/[id]/events/route.ts` | 學生事件時間軸 |
| `src/app/api/lessons/[id]/route.ts`（GET） | 整堂課：名單、老師、掛的課卡 |
| `src/app/api/lessons/[id]/periods/[periodId]/attendance/route.ts`（GET） | 任意時段的點名紀錄 |
| `src/app/api/lessons/[id]/students/route.ts` | 課程名單 + 逐時段出缺勤 |
| `src/app/api/lessons/[id]/students/[studentId]/student-cards/route.ts` | 任意學生的課卡 |
| `src/app/api/lessons/[id]/check-student-cards/route.ts`（POST） | 可帶任意 `studentIds` 陣列探測 |

> 前兩批修補（commit `00cf407`、`fe13859`）只處理了**寫入**路由，
> 讀取路由被列為 follow-up 後就一直沒回頭做——這八個就是那份 follow-up 的殘留。

**已做**：八個 route 全部加上 `decodeAuthToken()` + `src/lib/authz.ts` 的
`findStudentInClassroom` / `findLessonInClassroom`，不屬於本教室時回 **404 而非 403**
（403 會洩漏「那個 id 存在，只是不是你的」）。
`check-student-cards` 另外把 `studentIds` 過濾至本教室，並驗證它是陣列。
attendance GET 的 period 查詢綁上 `lessonId`，否則別間教室的 periodId
搭自己的 lessonId 仍然查得到。
順手補上同檔案裡其他未 scoped 的操作：`POST /api/students/[id]/student-cards`
（買卡）現在會驗證學生、課卡、與 `lessonId` 三者都屬於呼叫者的教室。

## [x] P0-2 `lineBindKey` 外洩 → LINE 綁定劫持 ✅ 2026-08-23 ⚠️ 曾是最嚴重

**攻擊鏈**：

1. `src/app/api/students/[id]/route.ts:118,260` 用 `...studentData` 展開整個 Student row
   回傳，`lineBindKey` / `randomKey` / `lineUserId` 全部一起吐出去。
   `src/service/studentDetail.ts:39,165` 與 `src/app/api/students/route.ts:73` 同樣寫法。
2. 攻擊者拿到 `lineBindKey`，傳給 LINE 官方帳號。
3. `src/app/api/line/webhook/route.ts:107` 直接 `findUnique({ where: { lineBindKey } })`
   並把 `lineUserId` 寫進該 Student。
4. 攻擊者**成為該學生**：可自助簽到（扣他的卡）、查課卡餘額、以他的名義購卡。

`/api/public-students/[randomKey]` 是**刻意公開**的分享頁，走的是同一個
`buildStudentDetailPayload`，所以連合法收到分享連結的人都能劫持綁定。這條路徑
即使修好 P0-1 也還在。

**修補時另外發現的第四個外洩**：`include: { classroom: true }` 會把
**`Classroom.checkinKey`** 一起帶出去——那是整間教室的現場 QR 自助簽到金鑰。
公開分享頁等於把教室的簽到看板網址送給任何拿到連結的人。

**已做**：新增 `toStudentPayload()`（`src/service/studentDetail.ts`）作為單一白名單，
五個呼叫點共用（`api/students/[id]`、`api/students`、`api/lessons/[id]`、
`api/lessons/[id]/students`、`buildStudentDetailPayload`）。`lineBindKey` / `lineUserId` 一律不回傳；
`randomKey` 只在 `includeShareKey: true`（老師端）時附上。
所有 `classroom: true` 改成 `classroom: { select: { id, name } }`。
`lineBindKey` 現在只可能從 `api/students/[id]/line-bind-link` 出去（該 route 本身已正確
驗證 + scoped）。

> **教訓（新 route 請遵守）**：`...spread` 一個 DB row 到 API 回應，等於把未來新增的
> 每個欄位都預設公開。回傳 Student / Classroom / User 資料時**一律用白名單**，
> 學生資料直接用 `toStudentPayload()`。
> 回歸測試 `tests/api/api-authz.test.ts` 會遞迴掃描回應物件，
> 發現 `lineBindKey` / `lineUserId` / `checkinKey` 就失敗。

## [x] P0-3 殘留的跨教室 IDOR ✅ 2026-08-23

延續先前 IDOR 清查未完成的部分（寫入類 route 大多已修，見 commit `00cf407`）：

- **`PATCH /api/students/[id]`** — 重名檢查有帶 `classroomId`，但真正的
  `student.update({ where: { id } })` 沒有 → 可改別間教室學生的姓名／備註／舞種資格。
  **已修**：先過 `findStudentInClassroom`。
- **`PATCH /api/cards/[id]`** — 完全沒取 `classroomId`（同檔的 GET / DELETE 有）
  → 可改別間教室的課卡價格與堂數。**已修**：先查 scoped card 再 update。
- **`POST /api/students/[id]/tags`** — tag 本身是 classroom-scoped，但沒驗證
  `studentId` 屬於本教室 → 可把自己教室的 tag 掛到別人的學生身上。**已修**。
- **`src/domains/attendance/attendance.service.ts`** `fetchStudentsWithValidCards`
  只用 `id: { in: studentIds }` 查學生，未驗教室 → 點名時可對別間教室的學生扣卡。

**已做**：`fetchStudentsWithValidCards` 新增必填的 `classroomId` 參數（呼叫端一律傳
`lesson.classroomId`），`reconcileAndFinalize` 在回傳筆數少於請求筆數時**拒絕整批**
（而非默默跳過——部分成功會讓老師的名單與實際紀錄不一致）。
`selfCheckIn` 同步套用，這也順便把「學生與課程必須同教室」變成引擎層的保證，
兩個自助簽到入口都受惠。

## [x] P0-4 缺少節流 ✅ 2026-08-23（僅 login）

`POST /api/login` 原本可無限次嘗試密碼。因為這個 endpoint 刻意區分
「email 不存在」與「密碼錯誤」（見 commit `0b04823`），不擋的話同時開放
帳號枚舉與密碼暴力破解。

**已做**：新增 `src/lib/rateLimit.ts`——固定容量 Map + sliding window，
key 為 `email + IP`（單一攻擊者無法從別的 IP 把真正的使用者鎖在門外，
單一 IP 也無法對大量 email 噴灑）。15 分鐘內 10 次失敗後回 429 + `Retry-After`；
**登入成功會 `reset()`**，所以打錯兩次再成功的使用者不會累積計數。
被擋下的請求**不計入**視窗，避免攻擊者靠狂打把封鎖無限延長。
單元測試 `src/lib/rateLimit.test.ts`（9 項，不需 DB）。

**已知取捨**：狀態在單一 instance 的記憶體裡，多 instance 下實際上限是
「限制 × instance 數」，重啟即清空。這是刻意的——擋暴力破解（需要上千次嘗試）
綽綽有餘，不值得為此引入 Redis。真的需要精確節流時，把 `hit()` 的實作換成
Upstash Redis 即可，呼叫端不用改。

**尚未處理**：`/api/checkin/[key]/*` 仍無節流（`nanoid(10)` 難猜，
且該端點的信任模型本來就靠助教複核，見「已知取捨」）。

---

# P1 — 技術地基

## [ ] P1-1 Foreign key 全無索引

全 schema 只有 3 個 `@@index`。**Postgres 不會自動為 FK 建索引，Prisma 也不會**——
每個 `where: { classroomId }` / `where: { studentId }` 目前都是 Seq Scan。
現在資料量小所以無感，但成長是線性的，且 `GET /api/students/[id]` 本來就已經
把整份出席史拉進記憶體（見 P3-1），兩者會相乘。

需補（`prisma/schema.prisma` + migration）：

```
Student.classroomId          Card.classroomId           Lesson.classroomId
Lesson.groupId               StudentCard.studentId      StudentCard.cardId
LessonPeriod.lessonId        AttendanceRecord.studentId AttendanceRecord.studentCardId
Event.studentId              LessonStudent.studentId    LessonTeacher.teacherId
LessonCard.cardId            StudentTag.tagId           Membership.classroomId
Teacher.classroomId          InviteToken.classroomId
```

複合索引另補：
- `LessonPeriod(lessonId, startTime)` — 每日營收與行事曆查詢
- `StudentCard(studentId, expiredAt)` — 可用卡查詢（點名熱路徑）

**部署注意**：production 用手寫 `CREATE INDEX CONCURRENTLY` 避免鎖表。
`CONCURRENTLY` 不能在 transaction 內執行，Prisma migration 預設包 transaction，
需在 migration 檔頂端處理或拆成獨立檔。小表其實秒級完成，但既然 production 有人在用，
照規矩來。

## [ ] P1-2 輸入驗證層

- 專案沒有 zod 或任何 schema 驗證。
- **52 處 `parseInt(id)` 沒有 NaN 防護** → `/api/students/abc` 會讓 Prisma 丟出
  未捕捉的例外，回 500。
- POST body 直接解構，無型別檢查：買卡 API 的 `price` / `sessions` 可以傳負數或字串，
  直接寫進 `StudentCard` 汙染營收數字。

**做法**：裝 `zod`，新增 `src/lib/apiValidation.ts`（與既有的表單驗證
`src/lib/validation.ts` 分開）：
- `parseId(raw): number | null` — 統一取代所有 `parseInt(id)`
- 各 route 的 body schema，解析失敗回 400 帶欄位錯誤

**先套用在有金流語意的 route**（買卡、轉卡、確認付款、點名），其餘漸進遷移。

## [ ] P1-3 統一錯誤處理

64 個 route 只有 7 個有 try/catch。新增 `src/lib/apiHandler.ts` 的 `withApiHandler()`：
- 未預期例外 → log + 回通用 500（**不吐 stack**）
- `PrismaClientKnownRequestError` P2025 → 404、P2002 → 409

## [ ] P1-4 CI

專案沒有 `.github/`——那 23 支整合測試不會自動跑，只靠手動 `npm test`。

新增 `.github/workflows/ci.yml`：`services: postgres`（對齊 `docker-compose.yml` 的
port 54330 / postgres-password）→ `npm ci` → `npm run lint` → `npm run build` → `npm test`。
`tests/global-setup.ts` 會自動建 `googoocard_test` 並 migrate，CI 只需給指向 localhost 的
`DATABASE_URL`（`tests/test-db-url.ts` 的 localhost 守門會通過）。

---

# P2 — 功能藍圖

## [ ] P2-1 續卡提醒推播 ⭐ 下一個要做的

**為什麼是它**：判定邏輯與通知通道都已經在了，只差排程與去重，投入產出比最高。
學生課卡用完卻沒人提醒是直接的營收漏損。

**現有拼圖**：

| 元件 | 位置 | 狀態 |
|---|---|---|
| 「誰需要續卡」判定 | `src/service/studentTag.ts` 的 `computeNeedsRenewal()` | ✅ 已有 |
| 學生 LINE 身分 | `Student.lineUserId` | ✅ 已有 |
| LINE 通道與 Flex 訊息 | `src/lib/line.ts` | ✅ 部分 |

**缺的四塊**：

1. **`pushMessage()`** — `src/lib/line.ts` 目前只有 `replyMessage()`，需要 replyToken，
   只能被動回覆。主動推播要打 `POST https://api.line.me/v2/bot/message/push`，
   沿用同一份 `LINE_CHANNEL_ACCESS_TOKEN`，並遵守既有慣例：**外呼失敗一律吞掉，
   不得中斷主流程**。
2. **去重／冷卻** — 避免每天重複轟炸。
   **決定**：新開 `RenewalReminder` model（`studentId` / `sentAt` / `studentCardId`），
   **不要**塞進既有 `Event` 表——`GET /api/students/[id]/events` 會把所有 event 顯示在
   學生頁時間軸上，推播紀錄會污染 UI。預設冷卻 14 天。
3. **排程** — 專案沒有 `vercel.json` / `vercel.ts`，等於沒有任何 cron。
   新增 `vercel.ts`（Vercel 現行建議寫法，優於 `vercel.json`）宣告 cron 打
   `POST /api/cron/renewal-reminders`。**該 route 必須自己驗 `CRON_SECRET` header**——
   `/api` 在 middleware 是公開的，沒人會幫你擋。
4. **老師端開關** — 教室層級的推播開關與冷卻天數。最小版先寫死常數，
   `Classroom` 加欄位列為 backlog。

**測試**：沿用 `tests/api/` 模式，mock `@/lib/line` 的 push。
斷言只有「卡用完 + 已綁 LINE + 不在冷卻期內」的學生進入推播名單。
**絕不可打到真實 LINE API**（headless/CI 環境沒有正式 token，且會真的發訊息給學生）。

## Backlog（不排期，想到再補）

- **請假／補課** — 目前出席只有「有來／沒來」二元。加請假狀態（不扣堂）+ 補課到其他時段。
  教室最常見的營運需求，但會動到 `AttendanceRecord` 的語意，要想清楚。
- **課前報名（預約制）** — 現在是純 walk-in（`getTodayLessons()` 回傳當天所有課），
  老師無法預估人數。改動較大，會牽動 `LessonStudent` 與整個簽到流程。
- **自助購卡對帳 Phase 3** — `CardOrder` model + 轉帳末五碼 + 後台核銷。
  規劃已寫在 `student-login-checkin-payment-plan.md` 末段，目前只做到 `isPaid` 布林值
  與未付款清單（`/api/student-cards/unpaid`、`UnpaidBell.tsx`）。
- **課卡到期自動處理** — `StudentCard.expiredAt` 有欄位但沒有定期 job 去掃。
  可與 P2-1 的 cron 共用排程基礎設施。
- **營收 CSV 匯出** — 老師報稅／對帳用。
- **課程模板／重複排課** — 現在每期課要手動建所有 periods。

---

# P3 — 重構待辦

## [ ] P3-1 `GET /api/students/[id]` 的 in-memory 聚合

`src/app/api/students/[id]/route.ts` 的 GET 約 200 行，把該學生**全部**
`attendanceRecords` + `studentCards` + `lessons` 拉進記憶體，然後用
`lessons.find()` / `attendancesByLesson.find()` 在迴圈裡做 O(n²) 聚合。
學生累積幾百筆出席後會明顯變慢。

同時它與 `src/service/studentDetail.ts` 的 `buildStudentDetailPayload()` 邏輯高度重複
（後者服務 `/public-students` 與 LIFF）。應合併成**單一 builder + 不同欄位白名單**
——這也剛好是 P0-2 要做的事，兩者一起做。

## [ ] P3-2 其他

- **`GET /api/students` 無分頁**，且對每位學生 include 全部未過期卡 + tags + lessons。
- **`validateAttendanceRequest` 與 `validateUpdateAttendanceRequest`**
  （`src/domains/attendance/attendance.service.ts:29,63`）除了一行
  `attendanceTakenAt` 檢查外**完全相同**，應合併成帶 flag 的單一函式。
- **`Membership.role` 是 `String` 且永遠是 `"owner"`** — 沒有助教權限分級。
  任何被邀請加入教室的成員都能看營收、改課卡價格、刪學生。
  這在「已有多間教室在用」的前提下是產品缺口，不只是技術債。

---

# 已知取捨（刻意不做，別再重複討論）

這些是看起來像問題、但已經想過並決定接受的：

- **`/api/checkin/[key]` 不驗身分** — 現場 QR 看板的信任模型就是「教室相信學生只幫自己
  簽到」，助教稍後複核才定案。防護是教室邊界 + 日期邊界 + 金鑰可輪替。
  詳見 `architecture.md`「現場 QR 簽到」。
- **手動消耗課卡（consume route）永不阻擋** — 老師必須永遠有能力處理 legacy 與特殊情況。
- **`StudentCard.remainingSessions` 在轉換/停用時不歸零** — 與一般停用行為一致。
- **`prisma db push` 與 `migrate reset` 全面禁用** — 見 `architecture.md`「環境與部署注意」。
- **`Event` 表沒有 FK/cascade** — 刻意的鬆散引用，由讀取端過濾失效事件
  （`src/app/api/students/[id]/events/route.ts`）。
- **design-system-audit 的兩個保留 hex** — `#06C755`（LINE 品牌綠）與
  `#55BD95`（react-spinners 的 JS color prop）。
