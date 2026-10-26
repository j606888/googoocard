# Googoocard 系統架構

> 最後更新：2026-08-28（教室生命週期：離開／封存／移除成員）

Next.js 15 App Router 全端應用，管理舞蹈教室的課程、學生、點名與課卡收入。
Mobile-first，但**老師後台在桌面是滿版 + 側邊欄**，版型模式切在 `lg:`；`max-w-[480px]` 只剩學生端（LIFF、現場 QR）與 Drawer。版型該用哪種機制、以及待收斂的分岔，見 [`ui-responsive.md`](ui-responsive.md)。

## 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 19、Redux Toolkit + RTK Query、Tailwind CSS v4、Radix UI |
| 後端 | Next.js API Routes、Prisma 6、PostgreSQL（production 在 AWS RDS） |
| 認證 | JWT 存 httpOnly cookie，30 天效期、剩兩週自動續期（`src/lib/auth.ts`） |
| 測試 | Vitest（單元 + 整合，見[測試](#測試)） |

## 核心資料模型

```
Classroom（頂層容器，所有實體都屬於一間教室）
├── Student ──┬── StudentCard（學生持有的課卡實例：remainingSessions / expiredAt /
│             │                note / origin / convertedToId / transferredToId → 見「課卡轉換」「課卡轉讓」）
│             ├── StudentDanceQualification（學生 × 舞種 + 已完成階級 level，可買/用複習卡）
│             ├── StudentTag ── Tag（自由標籤；"Needs Renewal" 為系統自動維護）
│             └── Event（學生事件日誌：簽到、買卡、課卡用完）
├── DanceStyle（教室自訂舞種：name / color 色盤 key / hasLevels 分階 / sortOrder / archivedAt）
├── Card（課卡種類：價格/堂數；isPracticeCard + danceStyleId 定義複習卡）
├── Teacher（教室內的老師實體，不是 User：name / color 色盤 key / note / archivedAt）
└── Lesson（danceStyleId + level 初/中/進階 + kind fixed/ongoing + status inProgress/finished）
    ├── LessonCard（此課程接受哪些課卡）
    ├── LessonTeacher
    ├── LessonPeriod（單堂時段；attendanceTakenAt 標記已點名）
    │   └── AttendanceRecord（學生 × 時段 ×（可選）StudentCard；建立扣堂、移除退堂）
    └── LessonStudent（首次點名時 upsert 的修課關係）
```

要點：

- `Lesson.status` 由 `refreshLesson()`（`src/service/lesson.ts`）在每次點名操作後重算。
- 舞種是**教室資料**（`DanceStyle`），不是 enum——見下節「舞種（DanceStyle）」。
- `Lesson.danceStyleId`、`StudentDanceQualification.danceStyleId` 必填。
- `Card.danceStyleId`：複習卡（`isPracticeCard=true`）必填；一般卡為 `null`（或當分類標籤用，不影響可用性）。
  重構前建立的複習卡可能是 `null`（legacy），系統各處 fallback 到課程的舞種。

## 舞種（DanceStyle）

2026-10 起取代寫死的 `enum DanceType`（expand → contract 兩段 migration：`20261009120000_dance_styles` 建表回填、`20261010090000_dance_styles_contract` 移除 enum）。

- 每間教室在 **`/dance-styles`** 管理自己的舞種：新增、改名（同教室不可重名，`@@unique([classroomId, name])` → 409）、色盤選色、「分階」開關、上下排序、封存／還原。**新教室清單是空的**，開課／建立複習卡時會引導過去。
- **只封存不刪除**（沒有 DELETE API）：封存的舞種不出現在選單，但舊課、舊卡、學生資格照常顯示。
- API：`GET/POST /api/dance-styles`、`PATCH /api/dance-styles/[id]`（含 `archived: boolean`）、`PUT /api/dance-styles/order`（`ids` 必須剛好是該教室全部舞種，含封存，一次重寫所有 `sortOrder`）。寫入其他資源時用 `findDanceStyleInClassroom()`／`requireDanceStyleInClassroom()`（`src/lib/authz.ts`，後者直接丟 400）驗證，別教室或不存在 → 400 `DANCE_STYLE_NOT_FOUND`；缺 → 400 `DANCE_STYLE_REQUIRED`。
- 回應裡的舞種一律是 `DanceStyleSummary = { id, name, color, hasLevels }`，用 `danceStyleSummarySelect`（`src/lib/danceStyles.ts`）select，不要 `danceStyle: true`。
- 顏色：`color` 存色盤 key（`DANCE_STYLE_COLORS`），對應的 Tailwind class 寫死在 `src/lib/danceStyleColors.ts`（`danceStyleMeta(style)`），因為 Tailwind 只認得靜態 class。
- 前端：老師端用 `useDanceStyles()`（`styles` = 未封存、`byId` = 全部）；LIFF、QR 看板、公開學生頁讀 API 回應裡附帶的 `danceStyle`（它們沒有老師 session）。

## 老師頁（2026-10）

`/teachers` 是總覽（`GET /api/teachers/overview?month=`）、`/teachers/[id]` 是詳情（`GET /api/teachers/[id]?month=`），
彙總都在 `src/service/teachers.ts`，純計算在 `src/lib/teacherStats.ts`（有單元測試）。`GET /api/teachers` 維持輕量清單給開課的老師選單用。

- **只算已點名的時段**（`attendanceTakenAt` 有值）——跟收入頁同一條規則。學生自助簽到在老師定案前不算；時段結束了還沒點名的算「待點名」。月份以台北時間切。
- 一堂課有兩位老師時，**兩位都各算一堂**；總覽最上面的教室合計（`totals`）則是一個時段只算一次。
- 老師「教的舞種」**從老師教過的課推導**，不存資料表——不用維護，也不會跟實際排課不一致。
- 代表色沿用舞種的色盤 key（`DANCE_STYLE_COLORS`），新老師預設取第一個沒被在職老師用掉的顏色（`firstFreeTeacherColor`）。
- **刪除只限沒教過課的老師**（409 `TEACHER_HAS_LESSONS`），其他一律封存。封存的老師不出現在開課選單，但已經掛著這位老師的課照常顯示。
- 開課 / 改課的 `teacherIds` 會驗證都是本教室的老師（400 `TEACHER_NOT_FOUND`），封存的也算數。
- 數字會被別處的點名改變，而點名的 mutation 不會 invalidate `Teacher` tag，所以兩頁的 query 都用 `refetchOnMountOrArgChange`。

## 複習卡資格系統

**目的**：複習卡較便宜，只有完成某舞種初階的學生可購買/使用；
同時避免符合資格的學生在複習課誤用較貴的一般卡。

### 階級（2026-10 起）

有些舞種分初階／中階／進階班（例：Hustle），複習卡只有一種，但只能複習「自己已完成的階級以內」：

- `StudentDanceQualification.level` = 該舞種**已完成**的最高階級（1 初階、2 中階、3 進階）。
- `Lesson.level` = 這堂課教的階級，建課/編輯時手動選，預設 1。
- **用**複習卡：`學生 level ≥ 課程 level`。已完成中階（正在上進階）→ 可複習初階、中階；已完成初階 → 只能複習初階。
- **買**複習卡：學生頁 / LIFF（無課程）只要 level ≥ 1；課程內買卡（帶 `lessonId`）視為買來複習這堂，需達課程 level。
- 階級定義集中在 `src/lib/danceLevels.ts`（全舞種共用 3 階）。
- **只有 `DanceStyle.hasLevels` 開啟的舞種才分階**：關閉時課程與資格的 `level` 一律視為 1（資料保留，`requiredLevelFor()` 決定），UI 也不顯示階級選擇、星章與角標。
- 編輯學生：每個舞種一列分段按鈕——分階舞種 `未完成｜初階｜中階｜進階`，不分階 `未完成｜已完成`（選「已完成」不會把既有高階級降回 1）。學生列表徽章在分階且 level ≥ 2 時右上角掛數字。
- API：學生回應同時有 `danceQualifications: number[]`（舞種 id，徽章/篩選用）與 `danceLevels: { [danceStyleId]: level }`（資格判斷用）；`PATCH /api/students/[id]` 收 `danceLevels`，舊的 `danceQualifications` 陣列仍接受：新增的舞種為初階，已存在的舞種**保留原階級**（避免舊分頁把中階學生降回初階）。

### 單一真相：`src/domains/qualification/index.ts`

純函式模組（不 import prisma），**前後端共用**，所有資格判斷都必須走這裡：

| 函式 | 用途 |
|---|---|
| `isQualified(levels, danceStyleId, requiredLevel = 1)` | 學生該舞種已完成階級是否 ≥ requiredLevel |
| `toDanceLevels(rows)` | prisma 資格列 → `DanceLevels` map（server 共用） |
| `requiredDanceStyleFor(card, lesson?)` | 複習卡所需舞種 = `card.danceStyleId ?? lesson.danceStyleId ?? null` |
| `requiredLevelFor(lesson)` | `lesson.danceStyle.hasLevels ? lesson.level : 1` |
| `canUseCard(card, levels, lesson)` | 點名/扣堂情境（一定有課程上下文，需達課程階級） |
| `canBuyCard(card, levels, lesson?)` | 購買情境；失敗回 `NOT_QUALIFIED` 或 `UNKNOWN_DANCE_TYPE` |
| `cardMatchesLesson(card, lessonDanceStyleId)` | 複習卡能否掛到課程（null = legacy 通用，可掛任何課程） |

`lesson` 參數是 `QualifyingLesson = { danceStyleId, level, danceStyle: { hasLevels } }`。

### 新增舞種

不需要改程式：教室在 `/dance-styles` 新增即可。資格授予、買卡驗證、點名優先、UI 徽章與篩選全部由資料驅動。

### 驗證矩陣

| 情境 | 行為 | 位置 |
|---|---|---|
| 不符資格買複習卡 | **硬擋**：API 403 `STUDENT_NOT_QUALIFIED` + UI disable | `api/students/[id]/student-cards` POST、`BuyCard.tsx`、`BuyAndUseForm.tsx` |
| legacy 複習卡（無舞種）在學生頁購買 | 擋：API 422 `CARD_MISSING_DANCE_TYPE`（無課程上下文無法驗證）；課程內買卡帶 `lessonId` 則用課程舞種驗證 | 同上 |
| 符合資格者在複習課買/用一般卡 | **軟擋**：UI 預設鎖定一般卡，老師可點「手動切換覆蓋」放行 | `BuyAndUseForm.tsx`、`ChooseCardForm.tsx` |
| 課程掛上舞種不符的複習卡 | 擋：API 400 `PRACTICE_CARD_DANCE_TYPE_MISMATCH`（含卡名）+ UI 選單過濾 | `api/lessons` POST/PUT、`CardSelect.tsx` |
| 建/改複習卡未填舞種 | 擋：API 400 `PRACTICE_CARD_REQUIRES_DANCE_TYPE` + UI 必填驗證 | `api/cards` POST/PATCH、`cards/CardForm/useCardForm.ts` |
| 階級不足用複習卡（例：已完成初階，上中階課） | 點名不自動扣複習卡（`not_qualified`，UI 顯示「未具備中階複習資格」）；課程內買複習卡同樣硬擋 | `attendance.service.ts`、attendance route、`BuyAndUseForm.tsx`、`BuyCardDrawer.tsx` |
| 手動消耗任意卡（consume） | **不擋**——老師永遠可手動消耗，確保 legacy/特殊情況可處理 | consume route |

## 點名流程

入口：`src/app/api/lessons/[id]/periods/[periodId]/attendance/route.ts`
邏輯：`src/domains/attendance/attendance.service.ts`

### 自動選卡（POST/PUT 點名時，`selectStudentCard`）

1. **複習卡優先**：課程掛有複習卡、且學生具該卡所需舞種資格 → 強制從學生的可用複習卡中選（多張時自動挑推薦的那張）。在這之前還有一條：手上有這堂課體驗卡的人優先扣體驗卡（見「體驗課」）
2. 否則過濾出學生「可用」的卡（`canUseCard`，不符資格的複習卡被排除）——**恰好一張**才自動選，多張不選（留待人工）
3. 推薦排序：剩餘堂數最少 → 到期日最早 → id 最小（引擎的 `sortRecommended`；GET 分類用 route 裡同規則的 `getRecommendedStudentCard`）
4. 選中的卡 `remainingSessions -1`；移除點名時 `+1` 退回

### 未解決案例分類（GET，`findUncheckedType`）

點名後 `studentCardId` 為 null 的紀錄會被分類成 `uncheckedType`，由
`PendingStudents.tsx` 顯示並提供人工處理（選卡使用 / 買卡並使用）：

| uncheckedType | 意義 |
|---|---|
| `no_card` | 沒有任何符合課程的課卡 |
| `no_practice_card` | 符合資格但沒有複習卡（防止誤扣一般卡） |
| `multiple_cards` | 多張可用卡，回 `recommendedStudentCardId`；若因複習卡優先，`reason: "PRACTICE_PRIORITY"` |
| `not_checked` | 恰好一張可用卡，等確認 |
| `not_qualified` | 唯一的卡是複習卡但不符資格（含舞種不符的 legacy 掛卡） |

### 老師會被帶到哪一個時段（點名 CTA）

`summarizeLessonPeriods()`（`src/service/lesson.ts`）回的 `dueForAttendancePeriodId`
就是課程卡片上「點名」按鈕要開的時段：**當天的未點名時段優先**，沒有才 fallback 到
最早的未點名。歷史上它單純取最早的未點名，於是任何一個沒點到的舊時段（停課、忘記點）
都會把後續每次點名靜靜帶到錯的日期，而且會一路累積——production 已因此錯位兩週
（見 `docs/roadmap.md` P2-2）。backlog 不會被藏起來：`dueForAttendanceCount` 照舊顯示
「N 堂待點名」，`dueForAttendanceIsBacklog` 讓 `TimeSlotCard` 把日期標出來，
`PeriodInfo.tsx` 則在點名頁對「不是今天的時段」整塊轉成警示色。

時段本身可以改期：`PATCH /api/lessons/[id]/periods/[periodId]`（UI 在時段列表的
「修改時間」）。**出席紀錄是跟著時段走的**——`AttendanceRecord` 以 id 指向
`LessonPeriod`，所以改期不動紀錄也不動課卡，已點名的時段一樣能改。停課改期因此不必
刪掉時段重建（那會連同出席一起丟掉）。

## 課程型態與「進行中 / 已結束」（2026-10）

`Lesson.status` 只由 `deriveLessonStatus()`（`src/lib/lessonKind.ts`）決定，`refreshLesson()`
在每次點名、增刪改時段、改設定、結束/重開後重寫它：

| 條件 | status |
|---|---|
| `endedAt` 有值（老師手動結束） | `finished`，不論型態 |
| `kind = "ongoing"`（持續開課） | 永遠 `inProgress` |
| `kind = "fixed"`（固定期數，預設） | 全部時段點完 → `finished`，否則 `inProgress`（原本的行為） |

為什麼：有的教室一期先排好 5 堂（點完就該結束），有的教室一門課每週一直往下加
（沒有結束日）。後者在舊規則下每點完一堂就掉進「已結束」，老師得去那裡找課再開時段。

- **結束 / 重開**：`POST` / `DELETE /api/lessons/[id]/end`（課程設定頁、「＋下一堂」對話框）。
  替手動結束的課**排新時段會自動重開**（`POST .../periods` 會清掉 `endedAt`）。
- **一次排多堂**：`POST /api/lessons/[id]/periods` 接受 `{ startTime, endTime }` 或
  `{ periods: [...] }`（最多 12 筆）。
- **列表**（`features/lessons/`）：沒篩選的「進行中」依群組**直接展開**（`LessonGroupSection` +
  `LessonTable`，不再點進群組頁；收合狀態存 localStorage，key 帶 classroomId）。
  「已結束」與篩選中維持分頁的攤平列表。每列動作由 `lessonRowAction()` 決定：
  待點名 > 持續開課且沒排下一堂（「＋下一堂」，預設沿用上一堂的星期與時間、推到今天以後）> 無。
- 新增課程時選型態；上次選的型態依教室記在 localStorage 當預設。

## 學生自助簽到（LIFF 單一入口、點名一定綁卡）

2026-10 起自助簽到**只走 LINE LIFF**，每一筆都知道是誰本人。兩種進來的方式、同一個頁面 `/liff/checkin`：

| 進來的方式 | 網址 | 差別 |
|---|---|---|
| LINE 選單「上課簽到」 | `liff.line.me/{LIFF_ID}/checkin` | 沒綁 LINE →「掃門口的 QR 就能簽到」頁（`UnboundCheckin`）：LIFF 裡直接開 LINE 掃描器（`liff.scanCodeV2`，LIFF 設定要開「Scan QR」）掃到海報就帶 `?key=` 重開這頁；另列今天的課、綁定連結說明 |
| 門口海報 QR（手機相機掃） | `liff.line.me/{LIFF_ID}/checkin?key=<Classroom.checkinKey>` | 限定該教室；這個 LINE 在該教室沒有學生 →「第一次來嗎？」 |

舊的 `/checkin/[key]`（從名單點自己、不驗身分）已退役：頁面只會 redirect 到上面的 LIFF 網址（已印出的海報照常可用），兩支公開 API 已刪除。工作人員的備案是老師端點名頁本來就能現場加人。

### 身分（`LiffStudentGate acceptCheckinKey`）

- 帶 `?key=` 時 gate 在 `liff.init()` 之後才讀網址（LIFF 會先把 `liff.state` 還原成真網址），呼叫 `/api/liff/me?key=`：只看該教室的學生。
- 該教室沒有學生 → 403 `not_bound`，附 `classroomName`、`lineName`、`linePicture`（`verifyIdToken` 從 LINE verify 回應取 `name` / `picture`，要 LIFF 有 `profile` scope）→ `FirstTimeGate`：
  - 「是，第一次來」→ 填暱稱（預填 LINE 名稱）→ `POST /api/liff/register { key, name }` → `registerLineStudent()`（`src/service/student.ts`）。先 `SELECT … FOR UPDATE` 鎖教室列，所以重複送出／並發只會建一位、學號不會跳號；頭像用 LINE 頭像（`next.config.ts` 已允許 `profile.line-scdn.net`），寫 Event「自助登記」、`LineAccount` 切到 STUDENT。
  - **同名不擋**（跟老師端建立學生不同），交給待處理「可能重複」＋合併學員。
  - 「我來上過課」→ 不提供從名單認領自己（會被冒用），請小幫手在學生資料頁打開「顯示 QR」讓學生用 LINE 掃綁定。

### 引擎（`selfCheckIn()`，`src/domains/attendance/attendance.service.ts`）

每個時段各開一個 transaction、`source = STUDENT`、**不設 `attendanceTakenAt`**（定案權留給老師）、`@@unique([lessonPeriodId, studentId])` 保證冪等。卡怎麼付：

- `card: { studentCardId }` —— 必須在 `cardOptionsFor(student, lesson).usable` 內（否則 `card_not_usable` 400）。
- `card: { buyCardId }` —— 卡必須掛在這堂課（`lesson.cards`，否則 `card_not_offered` 400）且 `canBuyCard(card, levels, lesson)`（否則 `not_qualified` 403）。只有真的會用到時才建卡：`createStudentCardInTx()`（`src/service/studentCard.ts`，老師開卡、LIFF 購卡共用）、`purchaseSource STUDENT`、照牌價、未付款（體驗卡不在這裡賣，見下方「體驗課」）。
- 沒指定 → 引擎自己挑（`cardOptionsFor().autoPick`：practice 優先時挑推薦的那張；否則只有唯一一張才自動挑）。
- **`requireCard`（LIFF 一律開）**：寫入前先用 `planPeriodCards()` 在卡片副本上模擬每個時段扣哪張（選定的卡用完就換引擎自動挑），任何一個時段會沒卡 → `card_required` 400，**什麼都不寫**（也不買卡）。所以自助點名不再產生「沒綁卡」的出席；`UNBOUND_ATTENDANCE` 只剩老師端點名。

`/api/liff/today` 帶學生時，每堂課多回 `cardStatus = { usable, autoPickId, buyable }`（`src/service/checkin.ts` 的 `lessonCardStatus()`，跟引擎同一套規則），LIFF 畫面據此顯示「使用 X（剩 n 堂）」／多張卡讓學生選／「還沒有能用的課卡，下一步選一張」。`POST /api/liff/checkin` 回 `{ results, purchased, amountDue, unpaidCards }`，完成畫面寫「下課請找小幫手付款 $X」並提醒舊的未付卡。**不另外推播給學生**（當場買卡時老師端照常收到「待確認收款」`UNPAID_CARD` 推播）。

**加好友提示**：掃門口 QR 進來的人不一定加了官方帳號（LIFF 的 Add friend option 只在第一次授權時問、可以拒絕；建議設 Aggressive）。沒加好友就收不到續卡提醒、聊天室叫不出選單，所以完成畫面用 `liff.getFriendship()` 再查一次，沒加就顯示「加好友」（`AddFriendPrompt`，連 `line.me/R/ti/p/<NEXT_PUBLIC_LINE_OA_ID>`）。LIFF 沒連到官方帳號（getFriendship 丟錯）或沒設 OA ID 時不顯示。

### LINE 模擬器（`/dev/line`，測試環境限定）

不用手機、不用 LINE Developers 就能用不同 LINE 身分走 LIFF。`NEXT_PUBLIC_LINE_MOCK=1` 開啟；`VERCEL_ENV=production` 時一律關閉（`isLineMockEnabled()`，有單元測試）。
- 前端：所有 LIFF SDK 呼叫都經過 `src/lib/liffClient.ts` 的 `loadLiff()` / `getLiffId()`。模擬器的「手機」是 iframe，身分 JSON 放在 iframe 的 `name`（換頁也跟著走、每支手機各自一份），`loadLiff()` 看到就換成假 LIFF：永遠已登入、`getIDToken()` 回 `mock.<base64url>`、`closeWindow()` 通知模擬器顯示「已關閉」。
- 後端：`verifyIdToken` 看到 `mock.` 前綴就只在模擬模式解開，不打 LINE API；關閉時一律無效。其餘 LIFF API 完全不知道自己被模擬。
- `GET /api/dev/line-sim`（模擬模式外 404）：教室簽到 key、以 LINE 帳號分組的已綁學生（舊生／可用卡／未付）、未綁學生；`POST` 「模擬綁定」給未綁學生一個 `Umock…` LINE（代替綁定碼 webhook）。**會回 lineUserId**——這是它只能在模擬模式存在的原因。
- `POST /api/dev/line-sim/today-lesson`：「建一堂今天的測試課」——這個整點起兩個時段（跨過台北午夜的那段不建），掛一般卡＋體驗課卡，沒有就建測試卡（沒有舞種就建「測試舞種」）。
- 「已加好友」開關決定假 LIFF 的 `getFriendship()`，用來看簽到完成後的加好友提示。
- **聊天室**：手機旁另一支是跟官方帳號的對話，下方是真的 Rich Menu 圖（`RICH_MENU` 的區塊疊在圖上）。訊息／postback 送 `POST /api/dev/line-sim/bot`，交給真正的 `handleLineEvent()`、回覆收下來直接回傳，不打 LINE API；`FlexPreview.tsx` 只畫我們會用到的 Flex 子集。Bot 卡片上的 LIFF 按鈕等於在旁邊那支手機開頁。也可以直接打字測關鍵字或貼綁定碼。
- 模擬不到：LINE 內建瀏覽器、`liff.state` 轉址、LINE 對 Flex 的實際排版。上線前仍要用真 LINE 走一次。

### 體驗課（`Card.isTrial`）——老師登記，不在自助簽到賣

體驗課是一般的課程，`lesson.cards` 掛一張 `isTrial` 的卡。報名多半來自 Google 表單或現場、**上課前就收費**，所以 2026-10-25 起體驗一律由**老師在課程頁的「體驗名單」登記**（`src/service/trialRoster.ts`、`GET/POST /api/lessons/[id]/trials`），學生端不賣：

- **一筆報名 = 一張這堂課收的體驗卡的 `StudentCard`**，沒有另外的表。還沒用掉（剩餘 > 0）= 已報名；用在這堂課的時段 = 已上課（只列最近 30 筆）。
- 登記可以選既有學生或直接打名字（`createStudent`，同名不擋，交給「可能重複」）。收費預設 `defaultTrialPrice()`（`src/lib/trialPrice.ts`，前後端共用）：舊生 $0、新同學照牌價，可當場改；收了錢就一起記 `paymentMethod`／末五碼，收款人是登記的人；沒收就是一般的待確認收款。同一張體驗卡還沒用掉時不能重複登記（`ALREADY_REGISTERED`）。
- **點名**：`CheckPeriod` 把已報名的人跟既有紀錄一起預設勾選、標「體驗報名」；引擎 `cardOptionsFor()` 對手上有這堂課體驗卡的人**優先扣體驗卡**（舊生同時有一般卡也不會變成「多張卡待選」）。
- `isReturningStudent()`（`src/service/trial.ts`）：這間教室買過任何**非體驗**卡 = 舊生。
- 自助簽到：`buyable` 不含體驗卡、`buyCardId` 指體驗卡回 `card_not_offered`；但已登記的體驗卡學生自己簽到時照樣能用。體驗卡也**不會**出現在 `/liff/buy` 和 `/api/liff/cards`。

### 金鑰與 QR 看板

- `Classroom.checkinKey`（`nanoid(10)`）：只說明「哪間教室」，不證明是誰——身分永遠來自 LINE ID Token。老師第一次開 `/checkin-qr` 時 lazy 產生，外流時「重新產生」（`POST /api/checkin-key`）。
- `checkinEntryUrl()`（`src/service/checkin.ts`）：有 `NEXT_PUBLIC_LIFF_ID` 就是 LIFF 網址，否則退回 `/checkin/<key>`。
- 「今天有哪些課」：`getTodayLessons()`（台北時區，walk-in 制：當天所有課程都可簽，不限已報名的）。
- **今天沒課**時不是空狀態（`NoClassToday`）：`getTodayLessons()` 改回 `nextLesson`（先找他上過的課〔`LessonStudent`，同 LIFF 課表的「我的課」〕的下一個時段，沒有才退回教室的下一堂；帶 `mine` 與這堂的 `cardStatus`，畫面寫「會用 X，目前剩 n 堂」，剩 1 堂多一塊「上完這堂就用完了 → 課卡方案」）、`upcoming`（教室接下來 2 個時段，不含 nextLesson）、`myCards`（同 bot「我的課卡」：能用或未付的卡＋上次使用日）、`monthAttendance`（`monthAttendanceCount()`，台北這個月）。手動結束的課（`endedAt`）不算。今天有課時這些都不查。

## 分部（Location，2026-10）

同一間教室的不同上課地點（台南、高雄…）。照舞種的做法：教室自己在 `/locations` 管理（名稱、地址、排序、封存不刪），`GET/POST /api/locations`、`PATCH /api/locations/[id]`、`PUT /api/locations/order`。
- `Lesson.locationId` 選填（`ON DELETE SET NULL`），開課／編輯課程用 `LocationSelect`（chip，教室沒有分部就不顯示；記住上次選的，`getLastLessonLocation`）。課程寫入要驗分部屬於本教室（`LOCATION_NOT_FOUND` 400）。
- 嵌在課程回應裡只用 `locationSummarySelect`（id、name）。課程列表、詳情、行事曆、LIFF 簽到都顯示 `LocationBadge`；課程列表有 ≥2 個分部有課時多一排分部篩選（`availableLocationIds`）。
- `POST /api/locations/assign { locationId, lessonIds }`：把勾選的課一次標上分部——舊資料的批次整理，只改本教室、**還沒設定分部**的課。UI 是勾選清單（`AssignLocationDrawer`），「依星期」「依老師」只是快速勾選：同一天兩個分部都有課（週二台南、高雄各一班）所以不能只看星期。
- **課卡不分部限定**：點名、選卡、購卡規則完全沒變。
- `Classroom.lineListed`（分部頁上的開關，`PATCH /api/locations/settings`）＝在 LINE 官方帳號公開課表與價目表，見下一節。

## LINE（只給學生用，2026-10）

**LINE 只服務學生，老師一律用網站／App。** 老師綁定 LINE（網站產生綁定碼、老師 Flex 選單、LIFF 免密碼登入）已在 2026-10-26 移除；`User.lineUserId` 欄位還在但不再被讀，`LineAccount.menuMode` 同樣留著沒用（之後清 schema 時一起拿掉）。`/liff` 根頁只負責 LIFF 的 `liff.state` 轉址，直接打開就去「上課簽到」。

webhook（`src/app/api/line/webhook/route.ts`）只驗簽章，每個事件交給 `handleLineEvent(event, reply)`（`src/service/lineBot.ts`）。**全部是 reply、不是 push，不占官方帳號的訊息額度。**
- **Rich Menu**：一張、所有人共用、設成官方帳號預設選單。區塊定義 `src/lib/lineRichMenu.json`（左邊一大格「上課簽到」＋右邊 2×2：我的課卡／課表／課卡方案／更多），`liff:<path>` 開 LIFF、`postback:<action>` 送 `a=<action>` 給 bot。圖由 `npm run richmenu:image`（`scripts/generate-richmenu.mjs`，sharp＋lucide＋PingFang TC）產生到 `public/images/richmenu/main.png`；`npm run richmenu:provision` 預覽、加 `-- --yes` 才真的上傳並設成預設（用 env 的 `LINE_CHANNEL_ACCESS_TOKEN` 決定哪個官方帳號，重跑會刪掉同名舊選單）。內容依「這個 LINE 是誰」決定，所以不用逐人 link、沒有資料表。
- **LIFF 頁**（都有 `LiffHeader`：深綠頁首＋「教室 · 學生」膠囊；綁了多位學生（通常一間教室一位）時膠囊帶 ▾，點開底部面板切換）：
  - `/liff/checkin` 上課簽到（見上一節）。
  - `/liff/schedule` 課表：月曆、有課的日子標舞種色點、依舞種／分部篩選、點日期列當天的課；綁定學生多「我的課」（`LessonStudent`）。`GET /api/liff/schedule?month=`。
  - `/liff/plans` 課卡方案＝價目表＋購買：綁定學生可買（`POST /api/liff/student-cards`）；有資格的複習卡組標「已解鎖」，**沒資格的整組上鎖**——移到最後、標「未解鎖」、最上面寫怎麼解鎖（資格是老師在學生資料開的）、每列是鎖頭而不是停用的購買鈕、最下面連到課表；沒綁定的人只看價格＋「第一次來？掃門口 QR」。體驗課只列價格。`GET /api/liff/prices`。`/liff/buy`（舊連結、續卡提醒）渲染同一頁。
  - `/liff/cards` 我的課卡。
  - 課表與課卡方案**沒綁定也能看**：`LiffStudentGate` 的 `guest` 渲染訪客版，教室由 `resolveLiffClassroom()`（`src/service/liffClassroom.ts`）決定——帶 `studentId`（驗擁有權）→ 他的教室；帶 `classroomId` → 必須是公開教室，並記成 `browseClassroomId`；都沒帶 → 同 bot 的 `resolveLineClassroom()`，多間公開回 409 讓頁面列出來選。
- **看哪間教室**（官方帳號將來會給多間教室共用）——`resolveLineClassroom()`：綁定學生的教室 → 之前選過的公開教室（`LineAccount.browseClassroomId`）→ 唯一一間 `lineListed` 的教室；多間公開就 quick reply 讓他選（`a=pick`），零間回「目前還沒有公開的課表」。
- `a=schedule`（打字「課表」）：教室有 ≥2 個分部先問哪一個（含「全部」），再回未來 7 天（台北）的 carousel，一天一張、超過 8 堂顯示「還有 N 堂」；手動結束的課不列；選了有地址的分部附「地圖」按鈕。Rich Menu 的「課表」改開 LIFF 月曆。
- `a=prices`（打字「價目表」「課卡方案」）：`expiredAt = null` 的卡，分「課卡（各分部通用）」「<舞種> 複習卡」「體驗課」三組；綁定的學生多一個購買按鈕（開 `/liff/plans`）。
- `a=mycards`：目前學生（`currentStudent()`，LIFF 選的那位）還能用或未付的卡＋未付合計；未綁定回綁定說明。
- `a=more`（`buildMoreMenuFlex()`）：Rich Menu 大家共用，所以「更多」依身分不同——**綁定學生**：頁首「名字 · 教室」、上課紀錄（開 `/liff/cards?tab=attend`，附「這個月上了 n 堂」）、教室地點、切換教室（綁多位學生時）、灰字「也在別間教室上課？」（綁定說明）；**未綁定**：先說綁定才能簽到看課卡，再分「第一次來上課」（開 `/liff/checkin` 掃門口 QR）和「已經在上課了」（綁定說明），加教室地點、多間公開時的切換教室。教室沒有分部就不列教室地點。
- `a=locations`（打字「教室地點」「地點」「地址」）：教室的分部（未封存，照 `sortOrder`），有地址的整列點了開 Google Maps；沒有分部回「請直接問老師」。教室同 `resolveLineClassroom()`。
- **加好友（follow）**：已綁定的人（多半是門口登記後從簽到完成頁加好友）叫名字歡迎＋教室名；沒綁定的人告訴他可以看課表／價目、到教室掃門口 QR 登記。掃門口 QR **不會**自動加好友——LIFF 的 Add friend option（Aggressive）只問一次，所以簽到完成頁再用 `getFriendship()` 檢查、沒加就顯示 `AddFriendPrompt`。
- 打字其他文字：綁定學生回學生 Flex 選單、未綁定回說明＋quick reply；綁定碼永遠優先。
- **綁定／解除綁定都走 `src/service/lineBinding.ts`，各寫一筆 Event**（`resourceType = "student"`，畫在學生頁「動態」）：`bindStudentLine()`（綁定碼 webhook、LINE 模擬器的「模擬綁定」）寫「綁定 LINE · LINE 名稱「…」」，同教室換綁時舊學生另寫「解除 LINE 綁定」；`unbindStudentLine()` 是老師端「解除綁定」（`DELETE /api/students/[id]/line-binding`，入口在頁首 ⋯ 和「學生資料」的 LINE 列），給綁錯人用——清 `lineUserId`／`lineDisplayName`／`lineBindKey`／`lineInviteSentAt`，下次複製的是新連結、未綁定名單顯示未邀請；LINE 那邊不用清，`currentStudent()`／`resolveOwnedStudent()` 都比對 `lineUserId`，那個帳號自然就看不到這位學生。門口自助登記另寫「自助登記」、合併沿用「合併學員」，不重複寫綁定。
- **LINE 名稱與大頭照**（`Student.lineDisplayName`，老師端「學生資料」顯示、合併確認畫面也列出）：webhook 綁定時用 Messaging API 的 get-profile 抓（`fetchLineProfile()`，`src/lib/lineProfile.ts`；只對加了好友的人有回應，抓不到就照樣綁、沒有名稱），自助登記用 ID token 的 `name`；之後每次學生開 LIFF，`GET /api/liff/me` 用 ID token 的 name/picture 呼叫 `syncLineProfile()` 更新（舊綁定也是這樣補上）。大頭照規則：LINE 的照片只會換掉**預設頭像**（`/images/avatars/`）或舊的 LINE 照片，**老師上傳的照片永遠不動**；預設頭像只在第一次拿到 LINE 資料時換（之後老師改回預設就尊重）；解除／換綁時若頭像是 LINE 照片（`profile.line-scdn.net`）就換回預設的 Not Sure。
- Flex builder 是純函式（`src/lib/lineFlex.ts`，有單元測試），配色跟網站一致改成品牌綠（`src/lib/line.ts` 的 `BRAND`）。

## 買卡流程（StudentCard 建立）

兩個入口，同一個 API（`POST /api/students/[id]/student-cards`）：

1. **學生詳細頁** `BuyCard.tsx` — 無課程上下文，複習卡用 `card.danceStyleId` 驗證
2. **點名頁「買卡並使用」** `BuyAndUseForm.tsx` — 帶 `lessonId`，legacy 卡 fallback 用課程舞種；買完立即 consume

買卡會建立 `Event`（購買課卡）並刷新 Needs Renewal tag。四個寫入點（老師開卡、LIFF「購買課卡」、自助點名時當場選卡、課程頁體驗名單登記）都走 `createStudentCardInTx()`（`src/service/studentCard.ts`）。

## 收款（確認付款）

`POST /api/students/[id]/student-cards/[studentCardId]/confirm-payment`，body **全部選填**（不帶 body 的舊版 App 照常可確認）：

- `paymentMethod`：`CASH` / `TRANSFER`；`paymentReference`：轉帳末五碼。
- `receiverUserId`：**收款人＝錢現在在誰手上**，寫進 `paidByUserId`，預設是確認的人，必須是本教室成員（否則 400 `RECEIVER_NOT_MEMBER`）。這三個欄位是水庫（`~/projects/water-tank`）對帳要的資料。
- UI：`src/features/students/ConfirmPaymentDrawer.tsx`（卡片詳情、收入頁未付款、點名完成頁的「今日收款」共用）。
- 未付款**照算營收**（`periodRevenue` 本來就不看 `isPaid`），未付只是應收。

**下課對帳**：`GET /api/student-cards/collections?date=YYYY-MM-DD`（台北）回當天 `paidAt` 的卡依「收款人 × 方式」加總，以及當天有出席、還有未付卡的學生；顯示在點名完成頁（`CheckPeriodSuccess/DayCollections.tsx`）。點名名單（`StudentOption`）另標「未付 $X」「新學員」（`GET /api/students` 的 `unpaidAmount` / `isNewStudent`）。

## 合併學員

同一個人兩筆資料（多半是門口自助登記的新同學 ↔ 沒綁 LINE 的舊生）：學生詳情 ⋯「合併到另一位學員」，或待處理「可能重複」（帶 `?mergeInto=<id>` 直接開）。

- `GET /api/students/[id]/merge-preview?targetId=` / `POST /api/students/[id]/merge { targetId, keepLineFrom? }`，`src/service/studentMerge.ts`，單一 transaction（先鎖兩列）。
- `[id]` 是**被併掉**的（source），`targetId` 是保留的。課卡、出席、Event、續卡提醒紀錄直接搬；`LessonStudent`、`StudentTag` 去重後搬；舞種資格同舞種取較高 level。
- 同一時段兩邊都有出席（`@@unique([lessonPeriodId, studentId])`）：保留有綁卡的那筆（都有就保留 target 的），刪掉的那筆若有扣堂就退回它的卡。
- LINE：target 沒綁就移過去；兩邊綁了不同 LINE 必須帶 `keepLineFrom`（否則 400 `LINE_CONFLICT`）。`LineAccount.selectedStudentId` 跟著改指 target。
- source 封存（`archivedAt`）並記 `mergedIntoId`（純 Int、無 FK），不硬刪。

## 未綁定 LINE 的學員（上課前先綁好）

`/students/line-invites`（入口：學生名單底部「未綁定 LINE N 位」）：在籍、`lineUserId IS NULL` 的學生，依最近出席排序。`GET /api/students/line-invites` 每列附好可以貼到 LINE 的邀請文字（內含綁定 deep link，`src/service/lineInvite.ts`；**先在 GET 拿到文字，點擊時同步寫剪貼簿**——iOS Safari 擋 await 之後的寫入），複製後 `POST /api/students/[id]/line-invite` 記 `Student.lineInviteSentAt` 顯示「已邀請」。系統無法主動傳訊息給還沒加官方帳號的人，所以由老師傳。

## 課卡頁（價目表，2026-10）

`/cards` 是一張**依舞種分組的價目表**（`features/cards/CardList`）：組順序照教室的舞種排序、不限舞種排最後；組內一般 → 複習 → 體驗、再依堂數（`groupByDanceStyle`，`cardInsights.ts`）。分頁「開放購買／已下架」取代舊的「停用」摺疊區。

- **詳情點了才出現**：桌面是右側抽屜（`components/SideSheet.tsx`，背景調暗不模糊、有上一個／下一個），選取鏡射到 `?card=<id>`；手機是整頁 `/cards/[id]`。桌面打開 `/cards/[id]` 會導回 `/cards?card=<id>`——桌面只有一種呈現。
- **編輯／複製在同一個抽屜裡換成表單**，不疊第二層彈窗；手機用底部 `Drawer`。兩個外殼共用 `CardForm/useCardForm.ts`。
- **「這張卡給誰買」是三選一**（一般／複習／體驗），存回 `isPracticeCard` / `isTrial` 兩個布林（`cardKind` / `kindFlags`）；舊資料兩個都開時以複習卡為準。
- **改價只影響之後的購買**：表單上直接寫明；詳情列出 `issuedPrices`（`GET /api/cards/[id]`，依 `basePrice` 分組、只算 `origin = PURCHASE`，不含轉換／轉讓卡），看得到手上的卡照哪個價算。
- 「每堂省 $X」與表單的單堂價比較**只在同舞種的一般方案之間**——不限舞種那組常混著私人課，比了會誤導。

## 課卡轉換（StudentCard 轉換 / 淘汰舊卡種）

`POST /api/students/[id]/student-cards/[studentCardId]/convert`
（body：`targetCardId`、可選 `sessions`、可選 `note`）

用途：淘汰舊卡種時把學生手上還沒用完的卡換成新卡種。
例：Level 1 卡等堂升級成 Level 2 卡；複習卡剩 3 堂（含以內）折抵成 1 堂 Level 2 卡。

行為：

- 新卡 `origin = CONVERSION`、`isPaid = true`（無金流，避免落入未付款催收清單）
- 新卡 `finalPrice` = **舊卡剩餘價值** = `舊卡單堂價 × 舊卡剩餘堂數`
- 新卡 `totalSessions` = `sessions`，未指定時預設 = **剩餘價值 ÷ 新卡牌價單堂價（`card.price / card.sessions`），四捨五入、至少 1 堂**。
  換算是純函式 `src/domains/cardConversion`（`residualValueOf` / `suggestConversion`），轉換表單的即時預覽與 API 預設值共用同一份
- 老師可以手動改堂數。**超過換算值只提醒、不擋**（UI 紅字「以牌價計多 $X」）——補償／加碼是正當情境（2026-10-02 定案）。
  4.29 給 5 堂這種取整誤差不算加贈：門檻是換算值的無條件進位
- **未付款的卡不能轉換**（API 400 `CARD_UNPAID`、選單項目停用並寫「請先確認付款」）：
  新卡一律 `isPaid = true`，放行的話那筆欠款會憑空消失
- 舊卡設 `expiredAt`、`convertedToId` 指向新卡，`note` **附加**轉換說明（不覆蓋既有備註）；
  自動備註與 Event 都帶卡片編號（「已轉換為 #A0873「Level 2」4 堂…」、「由 #A0412「Level 1」剩餘 5 堂轉換而來。」）
- `remainingSessions` 刻意不歸零，與一般停用一致
- 轉成複習卡時照樣走 `canBuyCard` 資格檢查，不能靠轉換繞過
- 寫 `Event`（課卡轉換）並刷新 Needs Renewal tag

**營收語意（改動這裡前務必看懂）**：

- **課程月營收依舞種**（`income/session-monthly/[month]`）跟 `daily-summary` 用同一個 `periodRevenue`，各舞種加總必等於當月每日營收加總；收入頁的「依卡種」拆分則是前端從 `card-monthly/[month]` 的 `purchases` 推（`src/features/income/incomeInsights.ts`），不另開 API。
- **課卡月營收**（`income/card-monthly`，依購買日認列全額）必須 `where: { origin: "PURCHASE" }`，
  否則同一筆錢會在原始購買月與轉換月各算一次。
- **每日營收**（`periodRevenue` = `finalPrice / totalSessions`）照常攤提。因為新卡帶走的是
  剩餘價值，全期間總營收守恆；複習卡 3 堂折 1 堂時，那 1 堂會認列原本 3 堂的金額，這是刻意的。
- 學生 overview 的 `cardCount` / `totalSpend` / `totalSaved` 同樣只算 `origin = PURCHASE`。

轉換鏈的 FK（`convertedToId`）放在**舊卡**上指向新卡，所以支援多張舊卡合併成一張新卡。

**轉換鏈的顯示**：學生詳情（含公開頁／LIFF，`buildStudentDetailPayload`）的每張卡多帶
`convertedTo` / `convertedFrom`（`conversionLinksInclude`，`src/service/studentDetail.ts`，白名單欄位）。
新卡顯示「來自 #A0412 …」、舊卡標「已轉換」並顯示「已轉換為 #A0873 …」，剩餘堂數改稱「轉出堂數」。
後台點那一列會捲到另一端的卡並短暫高亮（被卡種篩選藏起來就先切回「全部」）；公開頁／LIFF 只顯示不跳轉。

## 課卡轉讓（剩餘堂數給另一位學生）

`POST /api/students/[id]/student-cards/[studentCardId]/transfer`（body：`toStudentId`、可選 `note`）；
寫入在 `performTransfer`（`src/service/studentCardTransfer.ts`）。2026-10-26 定案：**剩下的堂數整批轉，不能只轉一部分**。

- 對方拿到**同卡種**的新卡：`origin = TRANSFER`、`totalSessions = remainingSessions = 舊卡剩餘堂數`、
  `finalPrice = basePrice = 舊卡剩餘價值`（`residualValueOf`，單堂價不變，每日營收照常攤提、總額守恆）、
  `isPaid = true` 但 **`paidByUserId = null`**（錢在原卡收過了，沒有人手上多了錢）
- 舊卡設 `expiredAt` 與 `transferredToId`（一對一、`@unique`，放在舊卡上指向新卡）；`remainingSessions` 不歸零＝轉讓了幾堂。
  搶先以 `updateMany where expiredAt = null` 標結束，同一張卡同時轉兩次只有一個會成功
- 原因（`note`）寫進新卡備註、附加到舊卡備註；兩位學生各寫一筆 `Event`（課卡轉讓），兩位都刷新 Needs Renewal tag
- 擋：未付款（`CARD_UNPAID`，同轉換）、體驗課卡（`CARD_TRIAL`）、已結束、轉給自己（`SAME_STUDENT`）、
  別的教室（404）、已封存的學生（`STUDENT_ARCHIVED`）；複習卡要對方 `canBuyCard` 通過（403 `STUDENT_NOT_QUALIFIED`）
- 營收：所有「真的有金流」的統計都只算 `origin = PURCHASE`（課卡月營收、卡種營收、學生 overview），
  下課對帳（`student-cards/collections`）也是——轉換／轉讓的卡 `isPaid + paidAt` 都有值，不篩會被當成當天收的錢
- 轉換鏈或轉讓鏈上的卡（任一端）**不能刪除**，只能停用；刪了另一端會斷、轉入的堂數也會消失
- 顯示：老師端帶 `transferredTo` / `transferredFrom`（`transferLinksInclude`，含對方學生 id、名字）；
  公開頁／LIFF 用 `publicTransferLinksInclude`，**不帶對方名字**，只顯示編號

課卡的預覽（票根：每堂一顆圓點，可用綠、已上灰、轉讓出去綠色虛線圈）與詳情（票根＋「紀錄」時間線）的設計稿：
https://claude.ai/artifact/CXhjEmTYUz9MDHurt4zNdH

## 卡片編號（StudentCard.serialNumber）

每張 StudentCard 有一個**教室內流水號** `serialNumber`（從 1 開始），顯示成一個字母加四位數：
`#A0001`…`#A9999` → `#B0001`…（每個字母都從 0001 起、沒有 0000，一個字母 9999 張）。
格式化／解析是純函式 `src/lib/cardSerial.ts`（`formatCardSerial` / `parseCardSerial`），UI 用 `<CardSerial>`。

- **發號**：`nextCardSerial(tx, classroomId)`（`src/service/studentCardSerial.ts`）遞增 `Classroom.nextCardSerial`，
  必須在建卡的同一個 transaction 裡呼叫。所有建卡入口都走它：`createStudentCardInTx()`（後台買卡、LIFF 自助買卡、自助點名當場買卡、體驗名單）、`performConversion`、`performTransfer`。
  跟學生編號（`Classroom.nextStudentNumber`）同一個模式。
- **沒有 DB unique**：StudentCard 沒有 `classroomId`，加不了 `(classroomId, serialNumber)` 的唯一約束；
  唯一性由計數器那一列的 row lock 保證（同教室的並發建卡會排隊）。這是刻意的取捨——
  為了一個約束把 `classroomId` 反正規化到 StudentCard 不划算。**別在 transaction 外發號，也別用 `max + 1`。**
- **舊資料**：migration `20261002090000_add_student_card_serial` 依每間教室的 `createdAt, id` 順序補號，
  並把計數器推到 `max + 1`。`npm run db:deploy` 套用即補齊 production。
- **顯示位置**：學生詳情的卡片（後台、公開頁、LIFF）、轉換表單、點名選卡（`ChooseCardForm`）、卡種詳情的持卡人列表。
- **搜尋**：`GET /api/students?query=` 若 query 長得像卡號（`A0412`、`#a0412`）會多比對持有該卡的學生（含已結束的卡）。

## 課卡備註（StudentCard.note）

`PATCH /api/students/[id]/student-cards/[studentCardId]`（body：`note`，上限 500 字，
空字串或 `null` 皆清除）。任何狀態的卡都能編輯，包含已停用的卡。
轉換流程會自動寫入這個欄位，手動編輯會覆蓋系統文字 — 這是刻意的，老師有最終決定權。
購買時也能直接帶 `note`（`buyStudentCardSchema`，同樣上限 500 字，空白視為沒填）。

## 學生封存（Student.archivedAt）

學生**沒有刪除**，只有封存：`PATCH /api/students/[id]` body `{ archived: true | false }`。
封存不動任何課卡、出席、收入資料，隨時可還原。

- 老師端名單 `GET /api/students` 預設只列在籍；`?archived=1` 只列封存的。詳情頁照常可開。
- 學生端一律當作不存在：LIFF（`resolveOwnedStudent`、`/api/liff/me`、自助登記會當作這個 LINE 在該教室沒有學生）、
  LINE webhook 的「目前學生」、續卡提醒 cron。
- 不擋：已在課程名單裡的點名、收入與歷史報表。

## 學生詳情的出席統計

`overview.attendedCount` = 出席過的**時段數**；`thisMonthCount` / `lastMonthCount` 依
`lessonPeriod.startTime` 以台北時區分月（`attendanceCounts`，`src/service/studentDetail.ts`）。
舊的 `attendLessonCount`（其實是報名門數）已移除。老師端與公開頁／LIFF 共用
`buildAttendanceViews` 組 `attendancesByLesson` / `attendancesByDate`，後者每筆帶舞種、
扣的卡（`studentCard`）、`source` 與 `pending`（自助簽到、老師尚未定案）。
`attendancesByLesson` 每門課帶 `danceStyle` / `level` / `status`，每個時段帶 `periodNumber`
（第 N 堂）、`studentCard`、`pending`；前端「依課程」把所有課畫在同一條週軸上
（`AttendSection/lessonTimeline.ts`：缺席＝老師點過名但沒來，同週有缺就算缺，最多 36 週）。

## Tag 系統

- `Tag` / `StudentTag`：教室層級的自由標籤，學生編輯頁可增刪。
- **"Needs Renewal"** 由系統自動維護（`src/service/studentTag.ts` 的
  `refreshNeedsRenewalTag`）：學生最新一張多堂卡用完 → 自動加 tag，買新卡/退堂 → 自動移除。
  觸發點：點名（含取消勾選退堂）、買卡、課卡轉換／轉讓、停用課卡、合併學員。**不要手動增刪這個 tag 的邏輯**，改
  `findExhaustedRenewableCard` 即可（見下一節）。

## 續卡提醒推播（每日 cron）

判定的**唯一出處**是 `src/service/studentTag.ts` 的 **`findExhaustedRenewableCard(studentId)`**：
未過期、非單堂卡（`totalSessions > 1`）、同卡種中最新的一張，且剩餘堂數為 0 → 回傳那張卡。
`refreshNeedsRenewalTag()`（"Needs Renewal" tag）、續卡推播與老師端「需續約」App 推播都建立在它之上。
**要改續卡規則就改這個函式，不要在別處另寫一套。**

| 環節 | 位置 |
|---|---|
| 排程宣告 | ⚠️ **尚未接上**——見下方「排程檔待補」 |
| 進入點 | `GET /api/cron/renewal-reminders`（**GET**，Vercel cron 只發 GET） |
| 名單與推播 | `src/service/renewalReminder.ts` |
| 訊息 | `src/lib/line.ts` 的 `buildRenewalReminderFlex()` + `pushMessage()` |

**驗證**：`/api` 在 middleware 是公開的，route 自己比對
`Authorization: Bearer <CRON_SECRET>`（timing-safe；Vercel 設了 `CRON_SECRET` 會自動帶）。
**`CRON_SECRET` 未設定就一律拒絕。**

**教室開關**：環境變數 `RENEWAL_REMINDER_CLASSROOM_IDS`（逗號分隔的教室 id），
**未設定 = 一間都不推**（fail-closed）。欄位化＋老師端 UI 見 roadmap backlog。

**冷卻 14 天**（`RENEWAL_REMINDER_COOLDOWN_DAYS`），紀錄在 `RenewalReminder` 表。
**刻意不放進 `Event`**——`GET /api/students/[id]/events` 會把所有 event 畫在學生頁
時間軸上，推播紀錄放進去會污染 UI。

**兩層判定**：`Needs Renewal` tag 當預篩（縮小範圍），再逐人呼叫
`findExhaustedRenewableCard()` 複驗 —— 複驗擋掉 tag 漂移，也拿到卡名與 `studentCardId`。
封存教室（`Classroom.deletedAt`）要自己擋，cron 沒有 `apiRoute` 的 membership 檢查。

**推失敗不寫紀錄**：`pushMessage()` 回傳 `boolean`（不 throw，外呼失敗照慣例吞掉），
失敗就不落 `RenewalReminder`，否則 token 壞掉會靜靜地把冷卻期燒掉。

**`?dryRun=1`** 只回名單、不推播也不寫紀錄。上 production 或改判定邏輯後先用它確認名單。
測試一律 `vi.mock("@/lib/line")` 攔 `pushMessage`，**絕不可打到真實 LINE API**。

### ⚠️ 排程檔待補——這個功能目前不會自己跑

程式全都就位並測過了，但**沒有任何東西會定時呼叫它**：`vercel.ts` 曾經寫好又拿掉，
因為它會是這個專案第一份 Vercel 設定檔，而「omit 掉的欄位會不會重置 dashboard 的
build 設定」沒有實證，不值得為一個還沒要開的功能冒險。

要真正啟用時，三件事**一起做、一次驗證**：

1. 加回 `vercel.ts`（需 `npm i -D @vercel/config`）：

   ```ts
   import type { VercelConfig } from "@vercel/config/v1";
   export const config: VercelConfig = {
     crons: [{ path: "/api/cron/renewal-reminders", schedule: "0 2 * * *" }],
   };
   ```

   `0 2 * * *` UTC＝台北 10:00，每天一次（Hobby / Pro 都合法）。
   部署後確認 dashboard 的 build 設定沒被覆蓋；有疑慮就改成只含 `crons` 的 `vercel.json`。
2. Vercel 設 `CRON_SECRET` 與 `RENEWAL_REMINDER_CLASSROOM_IDS`。
3. `npm run db:deploy` 套用 `RenewalReminder` 的 migration。

在那之前部署是安全的：route 存在但沒有排程會呼叫它，而且 `CRON_SECRET` 未設 → 一律 401。

## 待處理與老師端 App 推播（2026-10）

「待處理」是老師需要動手處理的事，**是狀態不是訊息紀錄**：每一類直接從現有資料查，處理完就自動消失，
沒有通知表。唯一定義在 `src/service/todos.ts`（`getTodos()` / `countTodos()`），網頁鈴鐺
（`src/features/TodoBell.tsx`）、App（`mobile/`，S3 起）的待處理分頁、推播的 App 圖示數字都讀它。

| 類別（`TodoType`） | 怎麼算 | 處理完 | 推播觸發點 |
|---|---|---|---|
| `UNPAID_CARD` 待確認收款 | `StudentCard.isPaid = false`（封存學生照列，欠款還是欠款），**拖越久排越前**，附已用堂數 | 確認付款 | 學生在 LIFF 自助買卡、或自助點名時當場買卡（體驗課卡不在學生端賣） |
| `NEEDS_RENEWAL` 需續約 | 「Needs Renewal」tag，排除封存學生；**只列 30 天內有來上課的**（`RENEWAL_ACTIVE_DAYS`），更久沒來的只回 `inactiveRenewalCount`。每列附 `lastAttendedAt`、`lineBound`、`lastRemindedAt`（這次用完後的 LINE 續卡提醒） | 買新卡 → tag 移除 | `refreshNeedsRenewalTag()` 裡 tag **這次才加上**（`createMany skipDuplicates` 的 count = 1） |
| `UNBOUND_ATTENDANCE` 出席沒綁課卡 | `AttendanceRecord.studentCardId = null` | 綁上課卡 | `selfCheckIn()` 有時段是 `no_card`（LIFF 開了 `requireCard`，實際上只剩不帶 `requireCard` 的呼叫會發生） |
| 體驗後還沒買卡（**不是** `TodoType`、不推播） | 14 天內（`TRIAL_FOLLOW_UP_DAYS`）用體驗卡上過課、沒有任何非體驗卡的在籍學生，`trialFollowUps` | 買正式卡，或過了 14 天 | 無 |
| 可能重複（**不是** `TodoType`、不推播） | 同教室、在籍、名字相同（trim、不分大小寫）的學生組，`findPossibleDuplicates()` | 合併學員或改名 | 無 |

**兩層：要處理 vs. 提醒**（2026-10-26）。待確認收款＋出席沒綁課卡是「已經發生、要現在補」的 → `urgentCount`；
需續約、體驗後沒買卡、可能重複是「值得知道」的 → `reminderCount`。**紅色數字只算 `urgentCount`**：
鈴鐺、App 圖示、推播 badge（`countTodos()`）、Badging API 都是；`total` 留著等於 `urgentCount`（舊版 App 拿它設圖示）。
只剩提醒時鈴鐺顯示灰點、不顯示數字；底部「學生」分頁與側欄不再掛需續約人數（同一畫面兩個數字會打架，改看學生列表的篩選 chip）。

鈴鐺分「要處理／提醒」兩頁。要處理的兩類**就地處理**，不用回課程頁：「補卡」開 `BindAttendanceCardDialog`
（跟點名完成頁的「未綁定課卡學生」同一套 `PendingRecordAction`，`ExpandableAction inline` 攤開）、
「確認收款」開 `ConfirmPaymentDrawer`。兩個對話框都掛在 Popover 外面（Popover 一被點到外面就關，掛在裡面會連對話框一起卸載）。

老師自己在後台建未付款卡、點名時沒卡，**不推**（人就在現場），但一樣會出現在待處理。

**推播**：`src/service/push.ts` 的 `notifyClassroom()` → 教室所有 membership（owner + 助教）
扣掉 `NotificationPreference` 關掉該類的人 → 兩個管道同時發、各自吞錯：
- **App**：他們的 `PushToken` → `src/lib/expoPush.ts` → Expo Push Service（iOS 轉 APNs，日後 Android 轉 FCM）。
- **網頁**：他們的 `WebPushSubscription` → `src/lib/webPush.ts`（`web-push` 套件，標準 VAPID，瀏覽器自己的推播服務送達，
  不用第三方帳號）。404/410 的訂閱刪掉。沒設 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` 就不發。
  - 瀏覽器端：`/account` 的「這個裝置」開關（`src/hooks/useWebPush.ts`）註冊 `public/sw.js`、訂閱、`POST /api/web-push-subscriptions`；
    登出時 `disableWebPushOnLogout()` 退訂。**iPhone 要先加到主畫面（iOS 16.4+）才收得到**，瀏覽器分頁會顯示提示。
  - 點通知 → `/notification?classroomId=&next=`（`src/app/notification/page.tsx`）先切教室再整頁跳過去。
  - 主畫面圖示數字：推播時 sw.js 設、`TodoBell` 載入時也設（Badging API）。
- **永遠不 throw**，一律在交易 commit 之後呼叫——推播失敗不能讓學生買卡／簽到失敗。
- **所有教室都發**（原本的教室白名單 `PUSH_CLASSROOM_IDS` 在 2026-10 拿掉了）：收不收由老師自己決定——
  要裝 App 或在 `/account` 開啟這個裝置的通知，再依類別關。封存教室自己擋。
  本機會發給本機資料庫裡的訂閱（就是開發者自己的瀏覽器）；測試一律 mock 兩個管道。
- Expo 回 `DeviceNotRegistered` 的 token 直接刪掉。
- `EXPO_ACCESS_TOKEN` 只有在 Expo 後台開了 Enhanced push security 才需要。
- 測試一律 `vi.mock("@/lib/expoPush")`（`tests/api/todos-push.test.ts`）。

**API**：`GET /api/todos`（apiRoute）、`POST/DELETE /api/push-tokens`（sessionRoute；token 掛在人身上，
同一支手機換帳號登入會改掛）、`GET/PUT /api/notification-preferences`（apiRoute，目前教室；沒存過 = 開）。

### 老師端 iOS App（`mobile/`）

Expo（SDK 57、Expo Router、EAS），架構照 `../dance-note/mobile`，開發規則見 `mobile/AGENTS.md`。
分頁：**待處理**（原生，`GET /api/todos`）、課程／學生／收入（WebView 開網站）、**更多**（原生：切換教室、
網站其他頁、通知開關、登出、刪除帳號）。登入畫面也是原生的：email／密碼，加上 Sign in with Apple 與 Google（ID token 交給 `POST /api/auth/oauth`）。

**登入**：App 不用 cookie，用 bearer token。
- `POST /api/login` 帶 `X-Googoocard-Client: app` → body 回 `token`（`generateAppToken`，JWT 有 `app: true`、**沒有 classroomId**），不設 cookie。
- `readAuthSession()` 先讀 `Authorization: Bearer`，只接受 `app: true` 的 JWT（網頁 cookie 的 JWT 拿來當 bearer → 401）。
- App token 的「目前教室」= `User.currentClassroomId`，每個請求在 `decodeAuthToken()` 讀一次（順便擋已刪除帳號）。
  所以在 WebView 裡切換教室（會寫這個欄位），App 的原生畫面也跟著切；membership 照樣每次重驗。
- `POST /api/app/token`：只收 bearer，換一張新 token（App 每次啟動換，一個月內打開過就不會被登出）。
  只收 bearer 是故意的：網頁上的程式拿著 cookie 不能換到 App token。

**WebView 的登入**：WebView 的第一個請求是 `POST /api/app/web-session?next=/path`（帶 bearer），
伺服器發一張綁目前教室的網頁 cookie、303 到 `next`（只接受站內路徑）。不用原生同步 cookie。
App 換教室時重新走一次（`epoch` 當 WebView 的 key）。

**網頁在 App 裡**：WebView 的 user agent 尾巴是 `GoogoocardApp/1.0`（`src/lib/inApp.ts`），並在載入前注入一段 CSS：
`data-in-app="hide"` 的元素（底部導覽、鈴鐺、切換教室——App 裡都是原生的）藏起來，
`data-in-app="no-bottom-pad"` 拿掉底部留白，`data-in-app="flush-bottom"` 把墊在網頁底部導覽上方的按鈕列貼回底部。「加到主畫面」引導在 App 裡當作已安裝，不出現。
網頁裡按登出 → WebView 到 `/login` → App 也登出。

**App 內不能出現價格、方案、升級**（App Store 3.1.3(f)）——WebView 顯示的是整個網站，網站上要賣東西時記得用 `isInApp` 藏起來。

## 教室生命週期與角色

`Membership.role` 有四個值（`src/lib/roles.ts`），畫面上是三種角色（2026-10-26，設計稿：https://claude.ai/artifact/29gpTsPi7krWteueANXhiG）：

| role | 畫面 | 可做 | 不可做 |
|---|---|---|---|
| `owner` | 管理員（皇冠） | 建立教室的人，恰好一位（`Classroom.ownerId`）。管理員能做的全部＋封存教室、把教室交給別人 | 退出教室（要先轉出去）、被移除、被改角色 |
| `admin` | 管理員 | 邀請（指定角色）、改別人的角色、連結老師資料、移除成員（建立者除外） | 封存／轉移教室、改自己的角色 |
| `teacher` | 老師 | 日常功能全部；**一定連著一筆 `Teacher`**，課程頁最上面有「我接下來的課」 | 邀請、改角色、移除成員 |
| `assistant` | 小幫手 | 日常功能全部（跟老師一樣，收入頁、課卡價格也看得到改得到——刻意的決定） | 同老師；不能連老師資料 |

**角色只是權限的預設組合**（見下一節「權限與模組」）。日常功能不分權限，其他所有 route 對三種角色一視同仁；「管人」是 `members.manage`（邀請連結的建立／刪除、`PATCH`／`DELETE /api/memberships/[id]`，沒有就 403 `PERMISSION_DENIED`），預設只有管理員有。

**老師 ↔ 老師資料**：`Teacher.userId`（nullable，`@@unique([classroomId, userId])`——一個人在一間教室最多是一位老師）。
課程本來就有 `LessonTeacher`，所以「我接下來的課」直接從「掛著我這位老師的課」推導（`getMyUpcomingPeriods()`，`src/service/myLessons.ts`，`GET /api/me/lessons`：今天起 7 天、手動結束的課不算），**不做釘選**。
- `teacher` 一定要連（`TEACHER_REQUIRED`）；`admin`／`owner` 可選（會教課的管理員）；`assistant` 一律不連，改成小幫手會自動解除。
- 一筆老師資料只能連一個人（409 `TEACHER_ALREADY_LINKED`）；換連另一筆時舊的自動解除（`linkTeacher()`，`src/service/team.ts`）。
- 退出、被移除、刪帳號都會解除連結，`Teacher` 本身留著（舊課還掛著它）。

**邀請連結帶角色**：`InviteToken.role`＋`teacherId`。老師的連結一定指定一筆老師資料、只能用一次（`maxUses` 強制 1）。
兩條加入路徑（`POST /api/invite-tokens/[token]/join`，以及註冊／登入帶 `token` 的 `joinClassroom()`）都走 `redeemInvite()`；
若那筆老師資料在等待期間被連給別人，照樣以老師加入、只是不連，管理員之後再連。公開的 `GET /api/invite-tokens/[token]` 只回教室名稱與角色。

owner 不能「退出」——教室會變成沒有 owner，而 `Classroom.ownerId` 仍指向一個非成員。
要走就先**轉移擁有權**（`POST /api/memberships/[id]/transfer-ownership`，`/teams` 成員卡 ⋯ 選單的「把教室交給他」，只有 owner 能做）：
目標成員變 owner、原 owner 變 `admin`、`Classroom.ownerId` 跟著換，三筆寫入同一個交易，教室永遠恰好一位 owner。
之後原 owner 就能像其他成員一樣退出。不想交給別人就封存教室。

### 權限與模組（2026-10-26，`docs/modules-plan.md`）

**權限** `src/lib/permissions.ts`（純函式，server／client 共用）：`members.manage`、`modules.manage`、`curriculum.view`／`.edit`、`finance.view`／`.edit`。

| 權限 | owner | admin | teacher | assistant |
|---|---|---|---|---|
| `members.manage`、`modules.manage` | ✓ | ✓ | | |
| `curriculum.view` | ✓ | ✓ | ✓ | ✓ |
| `curriculum.edit` | ✓ | ✓ | ✓ | |
| `finance.view`、`finance.edit` | ✓ | ✓ | | |

- 實際權限＝owner 全部；其他人 `(ROLE_BUNDLES[role] ∪ Membership.grants) − Membership.revokes`，再拿掉「所屬模組沒開」的（`effectivePermissions`）。DB 只存跟預設組合的差異，新增權限改一行程式就全員生效。
- 團隊頁「改角色與權限」送完整勾選清單，server 用 `overridesFor()` 換成 grants／revokes：不能改 owner、不能改自己、**改角色會清掉個人調整**、只能給自己有的權限（403 `CANNOT_GRANT_PERMISSION`，以全部模組都開的狀態比較）。沒開的模組的勾選框不列，它們的個人調整原封不動。
- 「封存教室」「轉移教室」仍是 `requireOwner`，不是權限。

**模組** `ClassroomModule`（`@@unique([classroomId, module])`）：有這列＝開著。關掉＝刪掉這列，模組自己的資料不動。`/modules` 頁開關（`modules.manage`，`PUT`／`DELETE /api/classroom-modules/[module]`，冪等）。

**把關**：`decodeAuthToken()` 原本那次 membership 查詢一起帶回 `grants`／`revokes`／`modules`（`findMembershipAccess()`，`src/lib/access.ts`），`apiRoute` 算好放進 ctx 的 `permissions`／`modules`。
`apiRoute(handler, { permission })`：模組沒開 → 404 `MODULE_NOT_ENABLED`（對這間教室來說功能不存在）；沒權限 → 403 `PERMISSION_DENIED`。handler 裡要條件式檢查用 `assertCan(ctx, permission)`。
測試 mock `decodeAuthToken` 沒給這三個欄位時當成空的（＝沒開任何模組）；要測模組 API 就在 mock 裡給 `modules`，或像 `tests/api/permissions.test.ts` 那樣每次從 DB 讀。

**前端**：`GET /api/me/access` → `useAccess()`／`useCan()`／`useModuleEnabled()`（`src/hooks/useCan.ts`，載入中一律 false）藏導覽列與按鈕；`NavLink.permission`；模組頁面的 `layout.tsx` 包 `ModuleGate`（沒開／沒權限顯示空狀態）。這些都只是介面，API 才是防線。

**依賴單向**：核心不 import 模組（`src/**/curriculum`、`src/**/finance` 各層資料夾），模組之間也不互相 import——`eslint.config.mjs` 的 `no-restricted-imports` 擋。核心頁面要嵌模組元件時，針對那個檔案開例外並記在這裡。

### 模組：技能樹（`curriculum`，2026-10-27，`docs/modules-plan.md` 第 2 階段）

一個舞種一棵樹：`SkillCategory`（分類，tab）× `SkillTier`（等級欄，名稱照位置叫一轉、二轉…）× `Skill`。
- **待定區就是 `Skill.categoryId = null`**：放進樹只是填上分類與等級，留言、已讀都不用搬。放進樹要有等級（`TIER_REQUIRED`）。
- 樹上的技能只封存（`archivedAt`）；待定卡可以真的刪除，留言 cascade。刪分類／等級時技能搬到別處或一起封存；分類被刪掉的封存技能還原時回到待定區。至少留一個分類、一個等級，等級最多 10 個。
- 同一舞種的名字不重複（不分大小寫，`SKILL_NAME_TAKEN`）；貼上待定區時重複的跳過並回報。
- 每次改動在同一個 transaction 寫 `SkillChange`（存人看得懂的字：分類名、「二轉 · Lv2」）。
- 留言：`SkillComment`（一層回覆，回覆的回覆攤平）、`SkillCommentReaction`（一人一個，同一個再按＝取消）、`SkillCommentMention`（`mentionsIn` 子字串比對，teach-what 的已知行為）、`SkillTalkRead`。每個技能最多一則結論。留言表沒有 `classroomId`，一律經由 `skill.classroomId` 驗證。
- 權限：讀、留言、按表情、標結論＝`curriculum.view`；改樹＝`curriculum.edit`；刪別人的留言＝`members.manage`。
- 程式：純邏輯 `src/domains/curriculum/`（從 teach-what 搬，附測試）、`src/service/curriculum/`、`/api/curriculum/*`、`src/features/curriculum/`、`src/store/slices/curriculum.ts`（tag `SkillTree`／`SkillTalk`，`markSkillRead` 是 optimistic）。
- 對話框裡的選單用 `Menu`（會 portal 進對話框），不要用 Radix `Popover`——portal 到 body 的 popover 在 modal 對話框裡點不到。

### 刪除帳號（`DELETE /api/me`，`/account` 頁）

App Store Guideline 5.1.1(v) 要求 App 內能刪帳號。規則：
- 還擁有**未封存**的教室 → 409 `OWNS_CLASSROOMS`（附教室清單），要先轉出去或封存。
- `User` **匿名化而不是刪除**：`StudentCard.purchasedBy` / `paidBy`、封存教室的 `ownerId` 都還指著它，那是營收歷史。
  清掉名稱、email（改成 `deleted-{id}@deleted.invalid`，原 email 可以重新註冊）、密碼、LINE／Google／Apple 綁定（有 Apple refresh token 就順便撤銷 Sign in with Apple）、`currentClassroomId`，
  刪掉所有 membership、push token、web push 訂閱、通知偏好，設 `deletedAt`。
- **`User.deletedAt` 讓舊 JWT 失效**：JWT 30 天且無法撤銷，刪除後其他裝置上的 token 還在。
  刪掉的人沒有 membership，請求一定落在 `decodeAuthToken()` 的「沒有教室」分支，那裡多查一次
  `deletedAt`（`isDeletedUser`），是的話連 `userId` 都不回——`sessionRoute` 也就 401。有教室的一般請求不多花查詢。
- UI 要輸入「我確認要刪除」才能送出（照 dance-note 的做法）。

**刪除教室 = 軟刪除（封存）**，`Classroom.deletedAt`。整個 domain 沒有任何
`onDelete: Cascade`，真刪要依序拆掉約 16 張表，還會連營收與出席歷史一起銷毀。
`DELETE /api/classrooms/[id]` 因此只做三件事：

1. 設 `deletedAt`
2. 把 `checkinKey` 設 null——牆上那張 QR 看板當場失效
3. 清空所有指向它的 `User.currentClassroomId`

`Membership` **刻意保留**，這樣救回教室時整個團隊會一起回來。
救回目前只能手動 `UPDATE "Classroom" SET "deletedAt" = NULL WHERE id = ...`
（`checkinKey` 會在下次有人開 `/checkin-qr` 時重新產生）。

UI 在 `/teams` 頁底部的「危險操作」（`src/features/teams/TeamList/DangerZone.tsx`），
依角色顯示「退出教室」或「刪除教室」；刪除要求輸入教室名稱才能送出。

### 為什麼每個請求都要重查 membership

JWT 帶著 `classroomId`、活 30 天、而且無法撤銷。只信 JWT 的話，「退出」「移除成員」
「封存教室」三件事都會延遲最多一個月才生效。所以 **`decodeAuthToken()` 每次都會重讀
`Membership`**（`@@unique([userId, classroomId])` 的索引查詢），並 join
`classroom.deletedAt IS NULL`。這三個動作因此在下一個請求就生效。

查不到 membership 時回的是 `NO_CLASSROOM`（`= -1`，定義在 `src/lib/authz.ts`），
**不是 `undefined`**。這點很重要：多數 handler 仍然直接寫 `where: { classroomId }`，
而 Prisma 把 `undefined` 解讀成「這個條件不存在」——也就是**放大**成全資料庫查詢而不是收斂成空集合。
`-1` 永遠對不到任何列（Postgres identity 從 1 開始），所以那些 handler 會 fail closed。

## API 慣例

- 所有 handler 用 `decodeAuthToken()` 取 `{ userId, classroomId, role }`（JWT cookie，或 App 的 `Authorization: Bearer`）。
- 三個 route wrapper（`src/lib/apiRoute.ts`）：

  | Wrapper | 要求 | 用在哪 |
  |---|---|---|
  | `apiRoute` | 登入 **且** 是 `classroomId` 的現任成員，否則 401；handler 拿得到 `role` | 一般 classroom-scoped 路由 |
  | `sessionRoute` | 只要求登入，不要求教室 | 管理教室本身的路由（列出／建立／切換／退出／封存）——這些必須在 JWT 的教室已失效時仍然打得通，否則使用者會被鎖死沒有救回路徑 |
  | `publicApiRoute` | 不要求登入 | 本意是 login/signup、LINE webhook、LIFF、現場 QR 簽到；目前實際只有 `/api/cron/renewal-reminders` 用它（自己比對 `CRON_SECRET`），其餘公開 route 仍是沒包 wrapper 的一般 handler |

- Middleware（`src/middleware.ts`）保護除 `/`、`/login`、`/signup`、`/invitations`、`/liff`、`/checkin/`、`/api`、`/public-students`、`/privacy`、`/terms`（加上靜態資源）外的所有路由。
  （`/api` 整段在 middleware 層是公開的，真正的把關在各 handler。）
- 前端資料層全部走 RTK Query（`src/store/slices/`，一 resource 一檔），
  mutation 用 tag invalidation 同步 UI（`TAG_TYPES` 在 `store/api.ts`）。
- 學生 API 回傳的 `danceQualifications` 是扁平的舞種 id 陣列 `number[]`（不是 join table 物件）。
- PATCH student 時 `danceLevels` 與 `danceQualifications` 都是 `undefined` → 不動資格（保護舊 client）；
  給 `danceLevels`（`{ [danceStyleId]: level }`）或舊的 `danceQualifications` 陣列 → 整組同步（transaction 內 delete notIn + 逐筆 upsert；
  舊陣列新加的舞種給初階、已存在的保留原等級）。舞種 id 不屬於本教室 → 400 `DANCE_STYLE_NOT_FOUND`。

## 學生頭像（Student Avatars）

`Student.avatarUrl` 只是一個字串，可以是內建預設圖（`/images/avatars/*.png`）、上傳到 Cloudinary 後的 URL，或綁定 LINE 帶進來的 LINE 大頭照（`profile.line-scdn.net`，規則見「LINE（只給學生用）」的「LINE 名稱與大頭照」）——DB schema 不區分，靠網址前綴判斷（`src/lib/lineProfile.ts`）。

**預設頭像**（2026-10 起）：奇異鳥 × 學生在雙人舞裡的身分——Leader、Follower、Both、Not Sure、工作人員，新學生預設 Not Sure。圖是自己畫的，由 `scripts/generate-avatars.mjs` 從 `public/kiwi-bird.svg` 產生 PNG，要改圖就改腳本再重跑。原本 8 張預設圖不是自己的，已刪除，還在用的學生由 migration 改成 Not Sure。只是頭像，**不是**學生資料欄位（沒有「這位學生是 Leader」的資料可以篩選）。

- **選圖 UI**：`src/features/students/AvatarPicker.tsx`（可重用），由 NewStudent、EditStudent 與點名頁的 CreateStudent 共用。內含 5 張預設（下面有名稱）+ 一個「上傳」格子，預設清單在同檔的 `PRESET_AVATARS`。
- **上傳流程**：signed direct upload。前端先 `POST /api/upload-signature`（`decodeAuthToken` 把關，登入才給簽章），拿到簽章後把檔案**直接** POST 到 Cloudinary，避開 Vercel serverless 4.5MB body 限制、也讓 Cloudinary 處理 HEIC。回傳的 `secure_url` 存回 `avatarUrl`。
- **裁切設定**寫死在 `src/app/api/upload-signature/route.ts`（`c_fill,g_auto,256×256,q_auto`），且**必須與前端送出的 `transformation` 完全一致**，否則簽章驗證失敗。
- **環境變數**：`CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`（cloud name 與 api key 會回給前端，api secret 只留伺服器端）。沒設定時上傳會回 500，但預設頭像照常運作。不需要在 Cloudinary 後台建 upload preset。
- 上傳期間 `AvatarPicker` 透過 `onUploadingChange` 通知父層，Drawer 的 submit 以 `disabled` 鎖住，避免在拿到 URL 前送出。
- `next.config.ts` 的 `images.remotePatterns` 已允許 `res.cloudinary.com`（給 `next/image` 用）。

## 返回來源（StudentDetail back navigation）

進入 `/students/[id]` 的連結可帶 `?from=<encodedPath>`，返回鍵讀它決定回哪：有就回該頁、沒有（或非站內路徑）fallback 回 `/students`。helper 在 `src/lib/studentNav.ts`（`studentDetailHref` / `resolveBackHref`）。目前 check-success（`StudentInfo`）、課程詳情（`AttendanceOverview/RosterList`、`AttentionList`）與老師詳情（`TeacherDetail`）的入口會帶來源；桌面分割檢視的「完整頁面」帶 `/students?sel=<id>`，返回時會回到同一位學生被選取的名單；手機列表不帶、維持回 `/students`。未來其他頁面要此行為，連結改用 `studentDetailHref(id, pathname)` 即可。

## 學生頁版面（全寬名單＋右側抽屜，2026-10-26 改版）

`/students` 依寬度掛載**其中一棵樹**（`useSizeClass()`，≥1024px）——不是用 CSS 藏，因為兩棵都掛的話兩份篩選狀態會各自寫 localStorage 而分岔。設計稿：https://claude.ai/artifact/5K55zKbFRV5ef7NUGSmahz（方向 A）。

- **名單本身是同一套**：`StudentList` 的列由 `StudentTable` 畫，底下是 `DataView`——手機卡片、桌面表格，同一份 DOM。欄位：學生／舞種／剩餘／最近上課／近 8 週出席方格／狀態（需續約、未付 $X）。
- **手機**（`variant="page"`）：列是 `<Link>`，點了進整頁 `/students/[id]`。
- **桌面**（`variant="table"`）：`StudentsTableView` = 全寬名單 ＋ `SideSheet`（600px）。抽屜裡是 `StudentDetailHeader variant="pane"` ＋ `AttentionBar` ＋ `StudentDetail variant="pane"`，頂端有「開啟完整頁」。鍵盤：`/` 聚焦搜尋；抽屜開著時 ↑↓ 換人、Esc 關閉。
- 整列可點但仍可用鍵盤：primary 格是真的 `<button>`／`<Link>`，用 `after:absolute after:inset-0` 撐滿整列（`DataView` 每列都是 `relative`）。

**活躍度三區**（`activityOf()`，`studentFilters.ts`，門檻 `ACTIVE_DAYS = 30`）——production 有很多早就不來的學生，藏起來怪、混在一起又拖慢瀏覽，所以分區而不是隱藏：
- **在上課**：30 天內有出席；或從沒上過課、但 30 天內才加入（新生）。
- **有卡沒來**：不在上課，但還有剩餘堂數（已付錢卻沒在用，值得聯絡）。
- **已離開**：其他人。「全部」時這區預設收起來，只顯示「展開 N 位」。
分區在篩選＋排序**之後**才切；有輸入搜尋字時不分區、整份平鋪——找人不該被藏進收起來的區。目前選的分區存在 localStorage（`student-activity:<classroomId>`）。

「近 8 週出席」：`GET /api/students` 多回 `recentAttendAt`（近 63 天每次出席那堂課的上課時間，一個 `findMany` 不拉整份出席史），週在前端用 `weeklyCounts()` 依瀏覽器時區切——跟詳情頁的 13 週方格同一個定義與同一組深淺（`HEAT`）。

**提醒列** `AttentionBar`（抽屜、桌面完整頁、手機詳情頁都有）：一次只講一件，未付款 > 需續約 > 有卡沒來（`attentionFor()`，`StudentDetail/attention.ts`）。只有一張未付卡時可直接「確認收款」；需續約不放按鈕（頁首就有「購買課卡」）；刻意不做「傳 LINE 提醒」（沒有這個功能）。

選取狀態同時活在 React state 與網址：**state 是畫面的真相**（`router.replace` 只改 query 時不會讓這頁的 `useSearchParams()` 重繪，靠網址驅動會整個選不動），**網址是可分享的鏡射**，用 `history.replaceState` 寫回，所以連續看十位學生不會在瀏覽紀錄堆十筆。

抽屜與獨立學生頁 `/students/[id]`（桌面）是**同一套**版面（2026-10 改版，舊的三欄完整頁已移除）：
頁首（大頭貼、舞種 pill、標籤、編輯／⋯／購買課卡、四格統計 `StudentStats`）＋ 底線分頁 課卡／出席／動態 ＋
右側欄 `ProfilePanels`（舞種資格點一下就存、學生資料、公開頁）。側欄要內容寬度 ≥ `SIDE_PANEL_MIN_WIDTH`
（1000px，`useElementWidth` 量的是詳情容器，不是 viewport）才擺在右邊；不夠寬就收成第四個「資料」分頁。
⋯ 選單：複製公開頁連結、複製 LINE 綁定連結（未綁定時）、合併到另一位學員、封存／還原學生。
手機老師端是 課卡／出席／動態／資料 四個分頁（「資料」就是桌面的側欄）；公開頁、LIFF 仍是舊的「概要／課卡／出席／動態」分頁。

排序有四種（`SORT_OPTIONS`，`studentFilters.ts`）：姓名／編號／剩餘堂數（少到多）／最近上課（久到近），每種都可以切正序／倒序（`SortMenu` 底下的 `SortDirectionToggle`，篩選抽屜也有一份；倒序只反轉主要欄位，同分仍依姓名正序；換排序欄位會回到正序）。排序欄位與方向存在 localStorage（`student-sort:<classroomId>`、`student-sort-dir:<classroomId>`；沒存過預設依編號）。**一律在前端排**——列表沒有分頁，而且後兩者不是 DB 單一欄位排得出來的。`GET /api/students` 為此多回 `lastAttendAt` / `lastAttendLessonName`（巢狀 `take: 1`，靠 `AttendanceRecord @@index([studentId])`）。「最近上課」= 最近一次出席**那堂課的上課時間**（`lessonPeriod.startTime`），不是點名時間；學生自助簽到、尚未定案的也算。三個出口（名單、學生詳情、LIFF／分享頁）共用 `src/service/studentDetail.ts` 的 `lastAttendanceQuery` / `toLastAttendance`，別再各寫一份。

## 測試

```bash
npm test            # 跑全部（需先 docker-compose up -d）
npm run test:watch  # watch 模式
```

| 層 | 位置 | DB |
|---|---|---|
| 單元（資格規則） | `src/domains/qualification/index.test.ts` | 不需要 |
| 整合（API route + service） | `tests/api/*.test.ts` | `googoocard_test`（自動建立） |

- 整合測試用既有 docker Postgres（port 54330）裡**獨立的 `googoocard_test` database**，
  `tests/global-setup.ts` 自動 `prisma migrate deploy` 建立 schema。
- `tests/test-db-url.ts` 強制檢查 localhost——**絕不可能打到 production**。
- 測試資料用 `tests/factories.ts` 工廠建立；每個測試前 `resetDb()` truncate 全表。
- route handler 直接 import 呼叫（`GET/POST(request, { params })`），
  auth 以 `vi.hoisted` + `vi.mock("@/lib/auth")` 注入 classroomId。

## 環境與部署注意 ⚠️

- **環境變數採 fail-safe：本地是預設，production 需明確 opt-in。**
  - `.env` 只放本地（docker Postgres on `:54330`），**絕不放 production 憑證**：
    `postgresql://postgres:password@localhost:54330/googoocard?schema=public`
  - `.env.production`（gitignored）放 production RDS 的 `DATABASE_URL`，**只**被 `npm run db:deploy` 使用。
  - `npm run db:migrate` 會先跑 `scripts/require-local-db.mjs`，對任何非 localhost 的 URL **硬性拒絕**——即使 `DATABASE_URL` 不小心指向 production，`migrate dev` 也會被擋下。
- Migration 用 `npm run db:migrate`（dev）/ `npm run db:deploy`（prod）。
  **禁止 `prisma db push`**（schema drift）與 **`prisma migrate reset`**（清空資料）。
- 含 DROP COLUMN 的 migration 部署前先做 RDS snapshot；程式碼與 migration 同次部署。
- Migration 含資料 backfill 時，手寫 SQL 並確保 backfill 在 DROP 之前
  （範例：`prisma/migrations/20260611000000_replace_qualification_booleans_with_join_table/`）。

### ⚠️ 首次部署前必做：baseline 已用 db push 套用過的 migration

Production 過去是用 `prisma db push` 套 schema 的，所以 `Tag` / `StudentTag` 兩張表與
`DanceType` 的 `KIZOMBA` 值**早就存在於 RDS**，但 `_prisma_migrations` 表裡**沒有**對應紀錄。
直接跑 `prisma migrate deploy` 會從頭執行這些「待套用」的 migration，跑到
`CREATE TABLE "Tag"` / `ALTER TYPE ... ADD VALUE 'KIZOMBA'` 時報
`already exists` 而中斷——而且會**停在 `20260611...` 之前**，導致資格 backfill 根本沒跑，
但新程式碼已經預期 `StudentDanceQualification` / `Card.danceType` 存在。

**部署前，先在 production 把這些「已存在但沒紀錄」的 migration 標記為已套用（baseline）：**

```bash
# 1. 先確認目前 production 的 migration 狀態（哪些被視為 pending）
npm run db:status            # = prisma migrate status

# 2. 把所有「物件已存在、但只是缺紀錄」的 migration 逐一 resolve 成 applied
#    （依 db:status 的輸出為準；至少包含下列兩個 catch-up migration）
npx prisma migrate resolve --applied 20260315160000_add_tag_and_student_tag
npx prisma migrate resolve --applied 20260315161000_add_dance_type_kizomba
#    若 db:status 顯示更早的 migration 也未紀錄（db push 時期遺留），一併 resolve。

# 3. 再跑 deploy——此時只剩真正要套用的 20260611 會執行
npm run db:deploy            # = prisma migrate deploy
npm run db:status            # 確認全部 applied、無 pending
```

> `migrate resolve --applied` 只寫 `_prisma_migrations` 紀錄、**不執行** SQL，因此對既有
> 資料零影響；這是 Prisma 官方把「db push 過的庫」接回 migration 流程的標準做法。
> 之後的部署就回到單純 `npm run db:deploy` 即可，不需再 baseline。
