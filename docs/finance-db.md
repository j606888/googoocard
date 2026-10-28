# 水庫第二、三步：定案與資料表設計（草稿）

2026-10-28。設計稿：artifact「水庫待補設計稿」（`EgsExWUraCy4eQzqKqy7Ss`）。這份取代 `finance-plan.md` §6–§8、§10、§11 裡跟它衝突的地方。

**還沒寫 migration**。看過、改好這份之後才動 `schema.prisma`（照 CLAUDE.md：只用 `npm run db:migrate`）。

## 1. 已定案

| # | 題目 | 定案 |
|---|---|---|
| 1 | 分帳規則怎麼存 | 全教室 → 分部 → 課程三層，下一層沒寫就沿用上一層。新教室什麼都不設＝「不用算」 |
| 2 | 每天固定的費用除不盡 | 平攤到當天的課，早的堂多 1 元（$500 ÷ 3 ＝ 167／167／166） |
| 3 | 抽成取整 | 四捨五入到元 |
| 4 | 驗收存什麼 | 每驗收一堂存一份：金額、怎麼分、誰、什麼時候。點名之後被改，比得出差多少 → 退回待驗收 |
| 5 | 薪資單掛在誰身上 | `Teacher`。沒帳號的老師也有薪資單；助教也建一筆 `Teacher` |
| 6 | 助教 | 點名時就掛上去（誰）；費用照分帳規則（每堂或每天）自動算進薪水 |
| 7 | 助教費誰出 | 從當天的課出，**抽成前**扣，跟場地費一樣 |
| 8 | 從代收扣薪水 | 自動記一筆「扣抵」繳回（自動確認），再記一筆發薪 |
| 9 | 老師確認薪資單 | 要（沒問題／有問題），不擋發薪 |
| 10 | 關帳後點名被改 | 關帳的月份不動，差額記到下個月的薪資單「上月補差額」 |
| 11 | 請款怎麼還 | 送的人選：跟下次薪水一起／從自己手上的代收扣／老闆直接轉 |
| 12 | 老師拿錢的方式 | 先做三種：不用算、鐘點費、拆帳 |
| 13 | 沒卡的課 | 照暫估價（這門課最便宜的每堂價）可以驗收，但不能整批驗收 |
| 14 | 課程收入 | 預設從點名帶進來，水庫這邊是二次驗收。體驗課也是。**誰都可以驗收，記下是誰** |
| 15 | 活動（Party、工作坊） | 課程以外的才手動記；賺的錢預設全部進水庫基金 |
| 16 | 驗收提醒 | 晚上推播給當天有課的老師＋營收負責人，誰先驗收都可以 |
| 17 | 回本 % | 水庫基金 ÷ 建城貸款（`openingOwnerLoan`） |

一堂課的算法：

```
點名收入（Σ 每位出席者那張卡的每堂價；沒卡的用暫估價）
− 場地費（每堂固定，或每天固定平攤）
− 助教費（每堂固定，或每天固定平攤）
− 抽成（扣完上面兩項 × %，四捨五入到元）→ 水庫基金
＝ 分給老師（拆帳：平分或課程自訂比例；每人照取整規則取整，零頭歸營收負責人或水庫基金）
```

鐘點費：老師拿固定的錢，`收入 − 場地 − 助教 − 鐘點費` 留在教室（進水庫基金）。不用算：收入全部留在教室。

## 2. 原則

- **能算的不存**：點名收入、驗收前的每堂分帳、當天的帳、老師這個月、行事曆、場租帳、預收／待發／基金、回本 % 都是算出來的。
- **存的是人做的決定和外部事實**：規則（有版本）、驗收、手動改、活動收支、請款、月結、發薪、對帳數字。
- 金額一律整數（元）；日期一律台北時間當天 00:00；月份用該月 1 號 00:00。沿用第一步的慣例。
- 改動留紀錄：沿用 `FinanceEntryRevision` 的形狀（`before`／`after` Json＋`reason`＋`editedById`）。
- 不刪只作廢（`voidedAt`）。
- 模組的 model 放在 `schema.prisma` 檔尾的 `// ===== 模組：水庫 =====` 段。核心程式不 import 模組；模組可以讀核心的表。

## 3. 核心改動：每堂的助教

助教是「那一堂誰來幫忙」，不開水庫也有意義，所以放核心。點名頁多一行「今天的助教」，同一天後面的課預設帶入上一堂的助教。

```prisma
model LessonPeriodAssistant {
  id             Int          @id @default(autoincrement())
  lessonPeriodId Int
  lessonPeriod   LessonPeriod @relation(fields: [lessonPeriodId], references: [id])
  teacherId      Int
  teacher        Teacher      @relation(fields: [teacherId], references: [id])
  createdAt      DateTime     @default(now())

  @@unique([lessonPeriodId, teacherId])
  @@index([teacherId])
}

// Teacher 加一欄：只當助教的人，排課選老師時不列出（點名選助教時列在最前面）。
//   isAssistant Boolean @default(false)
```

## 4. 第二步：分帳規則、驗收

### 4.1 `FinanceSplitRule`（三層＋版本）

一列＝某一層在某天之後的設定。某一層（全教室、某個分部、某門課）**第一次設＝從頭算**（`effectiveFrom` = 1970-01-01）；之後改規則＝新增一列，`effectiveFrom` 預設是下個月 1 號（可以選從這個月 1 號）；如果那天生效的那列已經有了，就直接改它。歷史就是這些列本身，不另外開 revision 表。

已實作（2026-10-29，分支 `feat/finance-split`）：`src/domains/finance/split.ts`（純計算＋單元測試）、`src/service/finance/split.ts`、`GET/PUT /api/finance/split-rules`、`GET /api/finance/lessons?from=&to=`、`POST /api/finance/lessons/verify`、畫面 `/finance/verify`（每堂驗收）、`/finance/rules`（分帳規則）。還沒做：手動改實拿／整堂手動結算、當天的帳、行事曆、第一次設定精靈、小鎮拆出待發與基金。

```prisma
enum FinanceRuleScope { CLASSROOM LOCATION LESSON }
enum FinanceTeacherPay { NONE HOURLY SPLIT }      // 不用算／鐘點費／拆帳
enum FinanceFeeMode { NONE PER_LESSON PER_DAY }   // 場地費、助教費共用
enum FinanceVenuePayee { MEMBER EXTERNAL }        // 付給成員（進薪資單）／外面的場地（場租帳）
enum FinanceRemainderTo { REVENUE_OWNER FUND }

model FinanceSplitRule {
  id               Int                 @id @default(autoincrement())
  classroomId      Int
  scope            FinanceRuleScope
  locationId       Int?                // scope = LOCATION
  lessonId         Int?                // scope = LESSON
  effectiveFrom    DateTime            // 月初
  // 以下 null ＝ 沿用上一層（CLASSROOM 層的 null ＝ 預設值）
  teacherPay       FinanceTeacherPay?
  hourlyFee        Int?
  venueMode        FinanceFeeMode?
  venueAmount      Int?
  venuePayee       FinanceVenuePayee?
  venueTeacherId   Int?                // venuePayee = MEMBER 時付給誰（薪資單掛 Teacher）
  assistantMode    FinanceFeeMode?
  assistantAmount  Int?
  commissionPct    Int?                // 10 ＝ 10%
  manual           Boolean?            // 只在 LESSON 層：整門課手動結算
  // 只在 CLASSROOM 層
  roundTo          Int?                // 1／10／100，捨去
  remainderTo      FinanceRemainderTo?
  shares           FinanceSplitShare[] // 只在 LESSON 層：多位老師的比例；沒有＝平分
  reason           String?
  createdById      Int
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  @@unique([classroomId, scope, locationId, lessonId, effectiveFrom])
  @@index([locationId])
  @@index([lessonId])
}

model FinanceSplitShare {
  id        Int              @id @default(autoincrement())
  ruleId    Int
  rule      FinanceSplitRule @relation(fields: [ruleId], references: [id])
  teacherId Int
  pct       Int              // 60 ＝ 60%，一門課加起來 100

  @@unique([ruleId, teacherId])
  @@index([teacherId])
}
```

- 某堂用的規則：三層各自取 `effectiveFrom ≤ 那堂日期` 的最新一列，再由課程 → 分部 → 全教室逐欄往上找第一個非 null。這段寫成純函式（`src/domains/finance/splitRule.ts`），前後端共用，跟技能樹、資格判斷同一套做法。
- 注意 `@@unique` 裡有 nullable 欄位：Postgres 的 NULL 不算重複，所以「同一層同一天只有一列」要在 service 裡檢查（或改用 partial unique index，migration 手寫 SQL）。

### 4.2 `FinanceLessonSettlement`（每堂驗收）

驗收前不存，全部即時算。按驗收（或「改好並驗收」）才寫一列，存下當下算出來的結果。

```prisma
model FinanceLessonSettlement {
  id               Int                    @id @default(autoincrement())
  classroomId      Int
  lessonPeriodId   Int                    @unique
  ruleIds          Int[]                  // 用到的規則列（課程／分部／全教室）
  revenue          Int                    // 點名收入，含暫估
  estimated        Int                    @default(0) // 其中暫估的部分（沒卡的人）
  attendeeCount    Int
  venueFee         Int
  assistantFee     Int
  commission       Int                    // → 水庫基金
  remainder        Int                    // 零頭
  manual           Boolean                @default(false) // 整堂手動結算
  overridden       Boolean                @default(false) // 驗收時手動改過老師或實拿
  overrideReason   String?
  lines            FinanceSettlementLine[]
  revisions        FinanceSettlementRevision[]
  verifiedById     Int
  verifiedAt       DateTime
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  @@index([classroomId, verifiedAt])
}

enum FinanceLineKind { TEACHER VENUE ASSISTANT REMAINDER }

// 這堂分給誰多少。月結、老師這個月都從這裡（或驗收前的即時計算）加總。
model FinanceSettlementLine {
  id           Int                     @id @default(autoincrement())
  settlementId Int
  settlement   FinanceLessonSettlement @relation(fields: [settlementId], references: [id])
  kind         FinanceLineKind
  teacherId    Int?                    // VENUE 付給外面的場地時是 null
  amount       Int

  @@index([settlementId])
  @@index([teacherId])
}

model FinanceSettlementRevision {   // 重新驗收、改數字的紀錄
  id           Int                     @id @default(autoincrement())
  settlementId Int
  settlement   FinanceLessonSettlement @relation(fields: [settlementId], references: [id])
  editedById   Int
  reason       String
  before       Json
  after        Json
  createdAt    DateTime                @default(now())

  @@index([settlementId])
}
```

- **「點名改過」**：讀的時候重算這堂，跟存的 `revenue`／`attendeeCount`／助教比，不一樣就顯示待驗收＋差多少。不另外存狀態，也不用在核心的點名程式裡通知水庫。
- **整批驗收**：只收「重算跟現在一樣、沒有暫估、沒有提醒」的堂。
- **關帳後重新驗收**：改這列（寫 revision），差額寫一筆 `FinanceAdjustment` 到下一個沒關帳的月份（§6.3）。

### 4.3 其他第二步的小改動

- `FinanceEntry.locationId Int?`：場租掛分部。場租帳＝這個分部 `category = 場租` 的支出 − 這個分部「每堂固定、付給外面的場地」已經算掉的場地費。正的是預付還剩，負的是欠場租。
- `FinanceSetting.payday Int @default(5)`：每月幾號發薪。

## 5. 活動（Party、工作坊）

```prisma
enum FinanceActivitySplit { FUND RULE MANUAL }   // 全部進基金／照分帳規則／自己填
enum FinanceActivityLineKind { INCOME EXPENSE SHARE }   // SHARE：split = MANUAL 時分給誰

model FinanceActivity {
  id           Int                   @id @default(autoincrement())
  classroomId  Int
  name         String
  date         DateTime
  locationId   Int?
  split        FinanceActivitySplit  @default(FUND)
  lines        FinanceActivityLine[]
  createdById  Int
  verifiedById Int?                  // 收入、花費填完存起來＝驗收過
  verifiedAt   DateTime?
  voidedAt     DateTime?
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  @@index([classroomId, date])
}

model FinanceActivityLine {
  id                Int                     @id @default(autoincrement())
  activityId        Int
  activity          FinanceActivity         @relation(fields: [activityId], references: [id])
  kind              FinanceActivityLineKind
  label             String
  amount            Int
  collectedByUserId Int?   // INCOME：現金在誰手上。不是營收負責人＝算他的代收
  entryId           Int?   // EXPENSE 從大水庫付：連到那筆 FinanceEntry
  claimId           Int?   // EXPENSE 是某人墊的：連到請款
  teacherId         Int?   // SHARE：分給哪位老師
  createdAt         DateTime                @default(now())

  @@index([activityId])
}
```

- 現場收的錢算收款人的代收：`src/service/finance/money.ts` 算代收時要加上 `collectedByUserId` 的收入列。
- 修改紀錄沿用 revision 形狀；實作時看要不要另開 `FinanceActivityRevision`。

## 6. 第三步：月結、薪資、請款

### 6.1 `FinanceMonth`

```prisma
enum FinanceMonthStatus { OPEN PUBLISHED PAID CLOSED }  // 檢查中／薪資單給大家看／發了／關帳

model FinanceMonth {
  id          Int                @id @default(autoincrement())
  classroomId Int
  month       DateTime           // 月初
  status      FinanceMonthStatus @default(OPEN)
  publishedAt DateTime?
  paidAt      DateTime?
  paidById    Int?
  closedAt    DateTime?
  closedById  Int?
  payslips    FinancePayslip[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@unique([classroomId, month])
}
```

- 沒有這列＝還在進行中的月份。老闆按「開始月結」才建。
- 關帳條件：這個月每堂點過名的課都驗收了（而且沒有「點名改過」）、活動都驗收了、核准的請款都處理了。

### 6.2 `FinancePayslip`＋`FinancePayslipLine`

「薪資單給大家看」那一刻，從驗收和請款、調整算出來寫進去，之後就不再即時算。

```prisma
enum FinancePayslipCheck { UNSEEN OK ISSUE }
enum FinancePayLineKind { SHARE VENUE ASSISTANT REMAINDER CLAIM ADJUSTMENT PRIOR_DIFF ACTIVITY }

model FinancePayslip {
  id             Int                  @id @default(autoincrement())
  monthId        Int
  month          FinanceMonth         @relation(fields: [monthId], references: [id])
  teacherId      Int
  total          Int
  fromCustody    Int                  @default(0) // 從他手上的代收扣多少
  transfer       Int                  @default(0) // 主堡轉多少
  check          FinancePayslipCheck  @default(UNSEEN)
  issueNote      String?
  checkedAt      DateTime?
  lines          FinancePayslipLine[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@unique([monthId, teacherId])
  @@index([teacherId])
}

model FinancePayslipLine {
  id             Int                @id @default(autoincrement())
  payslipId      Int
  payslip        FinancePayslip     @relation(fields: [payslipId], references: [id])
  kind           FinancePayLineKind
  amount         Int                // 可以是負的（調整、上月補差額）
  lessonPeriodId Int?
  claimId        Int?
  activityId     Int?
  adjustmentId   Int?
  note           String?

  @@index([payslipId])
}
```

- 老師這個月（月中）＝即時加總，不讀這兩張；發布之後才讀。
- 沒帳號的老師（`Teacher.userId` null）薪資單一樣有，由老闆代看。

### 6.3 `FinanceAdjustment`

月結時手動加減，以及關帳後重新驗收產生的「上月補差額」。

```prisma
model FinanceAdjustment {
  id                 Int      @id @default(autoincrement())
  classroomId        Int
  month              DateTime // 記到哪個月
  teacherId          Int
  amount             Int      // 正負都可以
  reason             String
  fromSettlementId   Int?     // 上月補差額：哪一堂
  createdById        Int
  voidedAt           DateTime?
  createdAt          DateTime @default(now())

  @@index([classroomId, month])
  @@index([teacherId])
}
```

### 6.4 發薪

按「發薪」時，一個 transaction 內：

- 主堡轉的：每人一筆 `FinanceEntry`（`category = 發薪`，`payeeUserId` 或 `payeeName`，`payslipId`）。
- 從代收扣的：一筆 `FinanceRemittance`（`kind = PAYROLL_DEDUCTION`、`status = CONFIRMED`、`reviewedById` = 按發薪的人、`payslipId`）。背包和主堡都看得到錢回來了。

所以要加：

```prisma
enum FinanceRemittanceKind { NORMAL PAYROLL_DEDUCTION CLAIM_DEDUCTION }
// FinanceRemittance 加：kind FinanceRemittanceKind @default(NORMAL)、payslipId Int?、claimId Int?
// FinanceEntry 加：payslipId Int?、claimId Int?、activityId Int?（還有 §4.3 的 locationId）
```

### 6.5 請款

```prisma
enum FinanceClaimRepay { PAYROLL CUSTODY DIRECT }   // 跟薪水一起／從我手上的代收扣／老闆直接轉
enum FinanceClaimStatus { PENDING APPROVED REJECTED WITHDRAWN PAID }

model FinanceClaim {
  id           Int                @id @default(autoincrement())
  classroomId  Int
  userId       Int                // 誰墊的
  teacherId    Int?               // 跟薪水一起還時，記到誰的薪資單（由 Teacher.userId 對）
  amount       Int
  spentOn      DateTime
  category     String             // 跟 FinanceEntry 同一套分類
  description  String?
  repay        FinanceClaimRepay  @default(PAYROLL)
  status       FinanceClaimStatus @default(PENDING)
  reviewedById Int?
  reviewedAt   DateTime?
  rejectReason String?
  activityId   Int?               // 是某個活動的花費
  photos       FinanceClaimPhoto[]
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  @@index([classroomId, status])
  @@index([userId])
}

model FinanceClaimPhoto {
  id        Int          @id @default(autoincrement())
  claimId   Int
  claim     FinanceClaim @relation(fields: [claimId], references: [id])
  url       String
  publicId  String       // Cloudinary，沿用學生頭像上傳
  createdAt DateTime     @default(now())

  @@index([claimId])
}
```

- 核准後：`PAYROLL` → 下次薪資單一行 `CLAIM`；`CUSTODY` → 一筆 `CLAIM_DEDUCTION` 繳回（自動確認）＋一筆 `FinanceEntry`；`DIRECT` → 一筆 `FinanceEntry`（`payeeUserId`）。付了才把狀態改 `PAID`。

## 7. 第一步收尾：Sheet 同步、並行期對帳

```prisma
model FinanceSheetSync {
  classroomId   Int       @id
  spreadsheetId String
  connectedAt   DateTime
  lastSyncedAt  DateTime?
  lastStatus    String?   // ok／error
  lastError     String?
}

model FinanceSheetSyncLog {
  id          Int       @id @default(autoincrement())
  classroomId Int
  trigger     String    // event／nightly
  startedAt   DateTime
  finishedAt  DateTime?
  status      String
  error       String?

  @@index([classroomId, startedAt])
}

// 並行期每天輸入的 Excel 數字；停用 Excel 之後就不再寫。
model FinanceReconcile {
  id                Int      @id @default(autoincrement())
  classroomId       Int
  date              DateTime
  excelVaultBalance Int
  excelTeacherFees  Json?    // { lessonPeriodId: 金額 }，量很小，不另外開表
  createdById       Int
  createdAt         DateTime @default(now())

  @@unique([classroomId, date])
}
```

## 8. 算出來的（不存）

| 東西 | 從哪裡算 |
|---|---|
| 點名收入 | `periodRevenue()`（`src/lib/income.ts`）；沒卡的人用這門課 `LessonCard` 裡最便宜的每堂價 |
| 驗收前的每堂分帳 | 規則（§4.1）＋點名＋`LessonPeriodAssistant` |
| 每天固定的費用平攤 | 同一天、同一分部、點過名的堂數；照開始時間排，早的多 1 元 |
| 當天的帳 | 那天的每堂分帳＋那天的收款、繳回、`FinanceEntry` |
| 老師這個月 | 驗收過的用 `FinanceSettlementLine`，還沒驗收的即時算 |
| 場租帳 | §4.3 |
| 預收／待發／基金 | 預收＝`prepaidValue()`；待發＝還沒發的薪資、場地費、助教費、請款；基金＝其餘 |
| 回本 % | 基金 ÷ `openingOwnerLoan` |
| 行事曆 | 課（點名、驗收狀態）、活動、繳回、`FinanceEntry`、請款、發薪日 |

## 9. 要注意的地方

- **排程**：晚上 10 點的驗收提醒、每晚 Sheet 全量覆寫都要 cron。專案還沒有 `vercel.ts` cron（續卡提醒也卡在這裡），三個要一起處理。推播沿用 `notifyUsers()`；它不看 `NotificationPreference`，跟第一步的繳回推播一樣。
- **NULL 與 unique**：`FinanceSplitRule` 的唯一性見 §4.1。
- **體驗課**：體驗卡的價錢就是點名收入，不用特別處理；之後若改成報到掃 QR 登記，只影響點名怎麼產生，不影響這裡。
- **退費**（特殊情況）：`FinanceEntry` 分類「退費」＋連到課卡，課卡本身要停用——這會動到核心的 `StudentCard`，等做特殊情況時再定。

## 10. 建議的 migration 順序

1. **核心**：`LessonPeriodAssistant`、`Teacher.isAssistant`，點名頁加「今天的助教」（另一個分支）。
2. **第二步**：`FinanceSplitRule`、`FinanceSplitShare`、`FinanceLessonSettlement`、`FinanceSettlementLine`、`FinanceSettlementRevision`、`FinanceEntry.locationId`、`FinanceSetting.payday`。
3. **活動**：`FinanceActivity`、`FinanceActivityLine`。
4. **第三步**：`FinanceMonth`、`FinancePayslip`、`FinancePayslipLine`、`FinanceAdjustment`、`FinanceClaim`、`FinanceClaimPhoto`，`FinanceRemittance`／`FinanceEntry` 加連結欄位。
5. **第一步收尾**：`FinanceSheetSync`、`FinanceSheetSyncLog`、`FinanceReconcile`。

新表一共 17 張（核心 1、水庫 16），另外改 4 張現有的表（`Teacher`、`FinanceSetting`、`FinanceEntry`、`FinanceRemittance`）。總覽上估「約 13 張」是把子表算在一起。
