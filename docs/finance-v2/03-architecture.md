# 03 · 架構：資料表、過帳器、鎖帳

> 讀者：實作的人。會計規則見 [`02-accounting-model.md`](02-accounting-model.md)。

---

## 1. 分層

```
營運資料（已有，不動）            財務子帳（feat/finance 沿用）          總帳（v2 新增）
StudentCard / AttendanceRecord    LessonSplitRule / PeriodSplitOverride   LedgerAccount（科目表）
AttendanceAbsence / DropInCharge  Venue / VenuePack                       MoneyAccount（資金帳戶）
Lesson / LessonPeriod / Location  FinanceExpense / FinanceRefund          JournalEntry / JournalLine
                                  （新）Payout / CashCount / OwnerTxn     PostingSource（過帳狀態）
            │                                   │                          ▲
            └──────────── 過帳器（posting engine）：來源 → 應有分錄 → 跟已過帳的比 → 記差額 ┘
                                                                           │
                                         報表（全部從 JournalLine 加總） ◀──┘
```

原則（沿用專案慣例「能算的不存，存人的決定和外部事實」，再加一條）：
- **總帳是唯一的數字來源。** 報表、首頁、結算全部讀 `JournalLine`，不再從營運資料重算（feat/finance 的 `loadLedger()`／`custodyFromLedger()` 移除）。
- **總帳只增不改。** 已過帳的分錄不 update、不 delete（開帳重做是唯一例外，見 04）。更正＝新分錄。

## 2. 資料表（Prisma 草案）

金額一律 **`Int`，單位「分」**（NT$333.33 存 33333）。理由：Postgres int4 上限約 NT$2,147 萬／行，夠用；避免浮點誤差；卡的每格價值用「最後一格吃尾差」保證整除。畫面顯示四捨五入到元。

```prisma
model LedgerAccount {          // 科目表（實作名稱；Prisma 不用泛用的 Account）
  id          Int     @id @default(autoincrement())
  classroomId Int
  code        String           // "1110"、"6100.01"
  name        String
  type        LedgerAccountType // ASSET LIABILITY EQUITY INCOME EXPENSE
  systemKey   String?          // CASH、DEFERRED_REVENUE…（02 §2）；子科目為 null
  parentId    Int?
  archivedAt  DateTime?
  @@unique([classroomId, code])
  @@unique([classroomId, systemKey])
}

model MoneyAccount {           // 資金帳戶（每個人的口袋／戶頭）
  id           Int     @id @default(autoincrement())
  classroomId  Int
  name         String
  kind         MoneyAccountKind // CASH BANK EWALLET
  holderUserId Int              // 保管人
  locationId   Int              // 這個帳戶的錢屬於哪個分部
  accountId    Int     @unique  // 對應的 1110 子科目
  isDefault    Boolean @default(false) // 這位保管人收款的預設帳戶
  archivedAt   DateTime?
}

model JournalEntry {
  id             Int      @id @default(autoincrement())
  classroomId    Int
  date           DateTime @db.Date      // 台北日期；報表都用這個
  kind           JournalEntryKind       // AUTO OPENING MANUAL REVERSAL CORRECTION
  sourceType     String?                // 見 §3；手動分錄為 null
  sourceId       Int?
  memo           String?
  reversesId     Int?                   // 沖銷哪一筆
  createdById    Int?                   // 系統過帳為 null
  createdAt      DateTime @default(now())
  lines          JournalLine[]
  @@index([classroomId, date])
  @@index([classroomId, sourceType, sourceId])
}

model JournalLine {
  id             Int     @id @default(autoincrement())
  entryId        Int
  classroomId    Int                    // 冗餘，給報表索引
  date           DateTime @db.Date      // 冗餘（= entry.date）
  accountId      Int
  locationId     Int                    // 分部；每筆分錄每個分部 Σ = 0
  amount         Int                    // 分；正＝借、負＝貸
  // 子帳維度（可選，給明細與帳齡）：
  partyType      String?                // STUDENT_CARD TEACHER VENUE USER STUDENT
  partyId        Int?
  lessonPeriodId Int?
  memo           String?
  @@index([classroomId, accountId, date])
  @@index([classroomId, locationId, date])
  @@index([classroomId, partyType, partyId])
}

model PostingSource {          // 每個來源目前過帳到的狀態
  classroomId Int
  sourceType  String
  sourceId    Int
  hash        String                    // 上次算出的「應有分錄」雜湊
  dirtyAt     DateTime?                 // 非 null = 待重算
  @@id([classroomId, sourceType, sourceId])
  @@index([classroomId, dirtyAt])
}
```

`Classroom` 加：`financeConversionDate`（轉換日，取代 `financeEnabledAt` 的會計意義）、`financeLockDate`（鎖帳日，null＝沒鎖）。

新增的子帳表（營運面的「人的決定」）：
- `Payout`：一次付款（付誰、從哪個資金帳戶、金額、日期、屬於哪個結算批次），取代 `FinanceTransfer` 裡付老師／場地／自己的部分。
- `MoneyTransfer`：資金帳戶之間轉帳（取代 `FinanceTransfer` 的 USER 類）。
- `OwnerTransaction`：業主投入／提取／宣告分紅。
- `CashCount`：盤點（帳戶、日期、系統餘額、實數、差額、誰數的）。
- `PayoutRun`：結算批次（期間、建立人、狀態 草稿→確認→完成）。
- `BadDebtWriteOff`：轉呆帳（卡或單堂）。
- `ManualJournal` 不用新表：手動分錄就是 `JournalEntry(kind=MANUAL)`。

沿用不動：`LessonSplitRule`、`PeriodSplitOverride`、`Venue`、`VenuePack`、`AttendanceAbsence`、`FinanceExpense`（加 `moneyAccountId`／`ownerAdvanceUserId` 二選一、`accountId` 費用子科目）、`FinanceRefund`（加 `moneyAccountId`）、`StudentCard.soldLocationId`、綁課卡／贈送卡／到期。

移除：`FinanceSettlement`（快照）、`FinanceBranchReview`、`Classroom.legacyCustodianUserId`（變成開帳選項）、`FinanceTransfer`（拆成 Payout／MoneyTransfer）。**feat/finance 還沒上 production，所以直接改 migration，不寫資料搬移**（見 06）。

## 3. 過帳器（posting engine）

### 3.1 來源（sourceType）
| sourceType | 一個來源＝ | 產生的分錄（02 §3） |
|---|---|---|
| `CARD` | 一張 StudentCard | 賣卡、付款、轉換／轉讓、到期、作廢、呆帳 |
| `PERIOD` | 一個 LessonPeriod | 收入認列（卡、缺席扣格、單堂）＋分帳成本＋次數包消耗 |
| `DROP_IN` | 一筆 DropInCharge | 單堂的收款（收入在 PERIOD） |
| `EXPENSE` | 一筆 FinanceExpense | 支出／代墊 |
| `REFUND` | 一筆 FinanceRefund | 退費 |
| `VENUE_PACK` | 一個 VenuePack | 買包 |
| `PAYOUT`／`MONEY_TRANSFER`／`OWNER_TXN`／`CASH_COUNT` | 各一筆 | 付款、轉帳、業主、盤點 |
| `OPENING` | 整個教室一個 | 期初分錄 |

### 3.2 每個來源一個純函式
```ts
// src/domains/ledger/post/<source>.ts —— 純函式，不碰 DB
type DesiredLine = { date: string; accountKey: AccountRef; locationId: number; amount: number; party?: Party; lessonPeriodId?: number; memo?: string };
function desiredLinesForPeriod(input: PeriodPostingInput, ctx: PostingContext): DesiredLine[];
```
- `PostingContext` 帶科目對照、資金帳戶→分部、轉換日。
- 輸出前經過 `balanceByBranch()`：每個日期、每個分部不平的部分補分部往來行。
- 轉換日之前的事一律不產生分錄（開帳分錄已經包含它們的結果）。

### 3.3 同步（sync）：算差額、只增不改
```
syncSource(tx, classroomId, sourceType, sourceId):
  desired = desiredLinesFor(source)               // 現在「應該」有的全部分錄行
  posted  = Σ 這個來源所有已過帳的行（按 日期×科目×分部×維度 聚合）
  delta   = desired − posted                      // 逐鍵相減
  if delta 全為 0: 更新 hash，結束
  每一行的日期 d → 實際記帳日 = d > lockDate ? d : lockDate + 1 天
  依實際記帳日分組，每組寫一筆 JournalEntry(kind = 第一次 AUTO、之後 CORRECTION)，lines = 該組 delta
  （分組後每個分部仍要平衡：先 balanceByBranch 再寫）
```
- 這就是 feat/finance「鎖住後的差額算進下個沒鎖的月份」的一般化：**任何日期**鎖帳都適用，不用逐月快照。
- 冪等：同一個來源 sync 幾次結果都一樣。
- 改分帳規則、改分部設定、改老師付款人這類「影響很多來源」的事：把受影響的來源標 dirty（例：改一門課的規則 → 那門課所有時段）。

### 3.4 什麼時候 sync
1. **寫入時標 dirty（同一個 transaction）**：所有會影響財務的寫入路徑呼叫 `markFinanceDirty(tx, sources)`。集中在 service 層（`createStudentCardInTx`、點名 `reconcileAndFinalize`、單堂、到期、轉換、轉讓、退費、支出…）。
2. **讀財務頁之前處理 dirty 佇列**（`flushFinance(classroomId)`，逐個 sync，有上限、可分批）。沒有 cron 也能運作；之後有排程再加背景處理。
3. **全量重算**（`resyncAll(classroomId)`）：把每個來源都 sync 一次。因為冪等，任何時候跑都安全；用來補「有人忘了標 dirty」的寫入路徑。財務設定頁給「重新檢查帳本」按鈕，回報修正了幾筆。
4. **健康檢查**：§5 恆等式寫成 `checkLedger(classroomId)`，結帳清單上顯示結果。

> 為什麼不在每次寫入時直接過帳：寫入路徑很多（點名、LIFF 自助簽到、合併學員…），全部改成同步過帳風險大、也拖慢點名。dirty 標記只是一行 insert，漏標也會被全量重算抓回來。

### 3.5 鎖帳
- `financeLockDate`：這天（含）以前的分錄不能新增、沖銷；過帳器的差額自動往後放。手動分錄日期 ≤ 鎖帳日 → 409 `PERIOD_LOCKED`。
- 鎖帳不限月底，任何一天都可以（預設建議月底）。
- 只有可以結算的人能把鎖帳日往後推；**往前（解鎖）只有 owner**，記稽核紀錄。解鎖後已經記的更正分錄不動（帳本只增不改）。
- 鎖帳前跑結帳清單（05 §3.6）。

### 3.6 子帳查詢（不另外存）
- 卡的預收明細／應收帳齡：`JournalLine where partyType = STUDENT_CARD` 依卡加總，加上卡的資料。
- 老師應付：`partyType = TEACHER`，可發／待學生付款兩個科目。
- 場地應付、業主應付同理。
- 一堂課的損益：`lessonPeriodId` 加總。

## 4. 程式位置

```
src/domains/ledger/            純函式（無 DB）：科目常數、DesiredLine、balanceByBranch、diff、每個來源的 post 函式、報表彙總、恆等式
src/service/ledger/            DB：sync、dirty 佇列、resync、開帳、鎖帳、報表查詢
src/domains/finance/           沿用：split.ts（computeSplit）、income.ts、months.ts（月份工具）、receiverDefault.ts
src/service/finance/           沿用：rules、bound、expiry、receiver、setup（改寫成開帳精靈）、access
                               移除：custody.ts、settlement.ts、branchReview.ts、ledger.ts（domains）、strayReceivers（併入健康檢查）
```

## 5. 測試
- `src/domains/ledger/**/*.test.ts`：每個來源的純函式，每個 02 §3 表格列一個案例；`balanceByBranch`、`diff`。
- **對拍測試**：spec §14 十一月整個情境，v2 算出的每位老師可發、每個分部利潤，要跟 feat/finance 的 `computeSplit` 結果逐分相等（只在移除舊程式前保留）。
- `tests/api/ledger-*.test.ts`：sync 冪等、鎖帳後的差額落點、跨分部往來、轉換日之前不過帳、resync 修復漏標。
- 恆等式測試：隨機產生一串營運事件（property-based，用固定 seed），每一步之後 `checkLedger` 必須全綠。

## 6. 效能
Bailamore 一年約數千堂時段 × 每堂十幾行，JournalLine 在十萬行等級，加總查詢用上面的索引就夠。報表需要時再加每月期末餘額的快取表（不是第一階段）。
