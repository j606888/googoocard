# 現場掃碼點名 × 新同學自建身分 × 未付款追帳（規劃稿）

> 狀態：**已實作（2026-10-25，分支 `feat/onsite-checkin-newcomer`）**。現況以 `docs/architecture.md`「學生自助簽到」「收款」「合併學員」為準；跟本文不同的取捨記在 `docs/roadmap.md`「已知取捨」（不做 `POSSIBLE_DUPLICATE` enum、名單點名直接退役不留備案）。
> 接續 `docs/student-login-checkin-payment-plan.md`（Phase 1 LINE 綁定、Phase 2 LIFF 簽到已上線；`/liff/buy` 的自助購卡已上線）。本文處理該文件沒涵蓋的：**第一次來的人**、**沒卡怎麼辦**、**收錢記到誰身上**。
> 同時是水庫（`~/projects/water-tank`，教室財務系統）的資料來源；串接規格見 water-tank `docs/attendance-integration.md`。

## 已確認決策

| 議題 | 決策 |
|---|---|
| 身分 | **LINE 就是帳號**，不另做註冊／密碼。幾乎所有學員都有 LINE |
| 第一次來 | 掃碼 → LIFF → 只填暱稱，**當場建立 `Student` 並綁定 LINE** |
| 沒卡上課 | 自助點名**一定要選卡**，沒有可用的卡就當場選一張（可未付款） |
| 未付款 | **永遠不擋**點名或買卡；未付款的卡照常扣到用完。點名時提醒學生、標示給小幫手，由教室負責追帳 |
| 舊學員沒綁 LINE | **上課前用訊息邀請綁定**（老師端批次發綁定連結）；現場遇到再由小幫手教他綁。LIFF 不提供「從名單認領自己」 |
| 付款時機 | 希望**下課當場付**；只在點名當下的畫面提醒，**不另外推播** |
| 體驗課 | **專門的體驗課程**，搭配獨立的體驗課 `Card`；新同學付費，**舊生來通常免費** |
| 重複學生 | 提供老師端**合併學員** |

**跟舊規劃稿不同的地方**：舊稿 Phase 3 建議 `income.ts` 排除未核銷卡。這裡改成**未付款也照算營收**（教室先墊，老師照上課分潤），未付款只是應收。現行 `periodRevenue` 本來就不看 `isPaid`，**不用改**。

---

## 1. 掃碼入口統一走 LIFF

- 門口海報的 QR 改成 LIFF 網址：`https://liff.line.me/{LIFF_ID}/checkin?key=<Classroom.checkinKey>`。用手機相機掃，直接在 LINE 裡打開，能拿到 ID Token，**每一筆自助點名都知道是誰本人**。
- 現在的 `/checkin/[key]`（從名單點自己名字、不驗身分）**改成只給工作人員用**：需要老師／小幫手登入，當作學生手機沒電時的備案。原網址導到 LIFF 版。
- `checkinKey` 仍只負責「哪間教室、今天」，維持可輪換。

## 2. LIFF 點名流程

```
掃碼 → LIFF 取 ID Token
  ├─ 已綁定（可能多個 Student → 沿用 LiffStudentGate 選身分）
  │    → 選今天的時段 → §3 選卡 → 完成
  └─ 未綁定 → 「第一次來嗎？」
       ├─ 是：填暱稱（預填 LINE 顯示名稱、頭像） → 建 Student + 綁定 → §3 選卡
       └─ 我來過：顯示「請找小幫手幫你綁定 LINE」（不在學生端認領，避免冒用）
```

- 建 `Student`：`classroomId` 來自 `checkinKey`，`number` 用 `Classroom.nextStudentNumber`（與老師端建立學生同一條 row lock 路徑），`lineUserId = sub`。
- **防重複**：暱稱跟本教室某位**未綁定**學生同名時，仍照常建立，但產生待辦「可能重複：新學員 X ↔ 既有學員 X」，讓老師用 §7 合併。
- 現行 `LiffStudentGate` 對未綁定帳號是直接擋下，要改成：從點名入口（帶 `key`）進來時，進「第一次來嗎？」畫面。其他 LIFF 頁（我的課卡、購買）維持擋下。

### 2.1 上課前先綁好（舊學員）

目標：現場只剩第一次來的人需要幫忙。

- 老師端新增「**未綁定 LINE 的學員**」清單（本教室 `lineUserId IS NULL`、未封存），依最近出席排序。
- 每位學員一鍵「複製邀請訊息」：內含既有的綁定連結（`/api/students/[id]/line-bind-link`），老師直接貼到 LINE 私訊或群組。系統無法主動推播給還沒加官方帳號的人，所以由老師發送。
- 清單顯示「已發邀請」時間（新增 `Student.lineInviteSentAt`），避免重複催。
- **現場**：小幫手在學員詳細頁打開該學員的綁定 QR，請學生用 LINE 掃，當場綁定後再自助點名。

## 3. 選卡規則（自助點名）

1. `selectStudentCard` 能挑到唯一一張有效卡 → 直接用，跟現在一樣。
2. 有多張 → 讓學生自己選（現在是留 `multiple_cards` 給小幫手，自助時改讓本人選）。
3. **沒有可用的卡 → 必選商品**：列出這堂課可用的 `Card`（`lesson.cards`，並走 `canBuyCard` 資格檢查），體驗課的規則見 §3.1。選了就建 `StudentCard`（`purchaseSource: STUDENT`、`isPaid: false`），重用 `createStudentCard`，再用這張卡建出席紀錄。
4. 完成畫面：「已點名 ✓　下課請找小幫手付款 **$400**」。只在這個畫面提醒，不另外推播。

### 3.1 體驗課

- 體驗課是專門的課程（`Lesson`），`lesson.cards` 掛體驗課 `Card`（`isTrial = true`）。
- 系統依身分給預設價：
  - **新同學**（這間教室沒有任何非體驗課的 `StudentCard`）→ 體驗課定價，`isPaid: false`，下課收錢。
  - **舊生** → 同一張體驗課卡，`finalPrice = 0`、`isPaid: true`（不用收錢）。沿用既有的 `basePrice` / `finalPrice`，不另做商品。
- 舊生「通常」免費，不是一定：工作人員可以照現有方式改 `finalPrice`。
- 營收：舊生那堂認列 0，水庫看到的也是 0。

**自助點名不再產生「沒綁卡」的出席紀錄。**沒綁卡（`UNBOUND_ATTENDANCE`）只剩工作人員手動點名時會出現。

## 4. 未付款：不擋，提醒＋追帳

**任何情況都讓學生點名或買卡**，未付款的卡照常扣到用完。教室負責追帳，系統負責讓「誰還沒付」一直看得到：

- **學生端**：點名時若名下有未付款的卡，完成畫面多一行「你有一張課卡尚未付款（$2,000），請跟小幫手確認」。
- **小幫手端**：該學生每次點名（自助或工作人員），`CheckPeriod` 名單上在他旁邊標「未付款 $2,000」，當堂就知道要收。
- **追帳清單**：既有的 `UNPAID_CARD` 待辦依**未付款天數**排序，並顯示已用掉幾堂。

## 5. 收款：記下誰收的、怎麼收

在現有的「確認付款」（`UnpaidBell` / `/api/student-cards/unpaid`）多問兩件事：

| 欄位 | 說明 |
|---|---|
| `paidByUserId`（既有） | 語意明確為**收款人**＝錢現在在誰手上。預設目前登入的人，可改選其他老師（例如學生轉帳到老師帳戶） |
| `paymentMethod`（新增） | `CASH` / `TRANSFER` |
| `paymentReference`（新增） | 轉帳末五碼，選填 |

Schema：

```prisma
enum PaymentMethod {
  CASH
  TRANSFER
}

model StudentCard {
  // ...
  paymentMethod    PaymentMethod?
  paymentReference String?
}
```

這三個欄位就是水庫要的「錢在誰手上」。小幫手收的現金交給老師的「換手」，在水庫記錄，點名系統不管。

## 6. 下課對帳（小幫手）

- **人數**：老師／小幫手在 `CheckPeriod` 定案（`attendanceTakenAt`）時，畫面顯示「名單 12 人」，提醒對照現場人數。
- **現金**：新增「今日收款」小卡，依 `paidByUserId` 列出每個人今天收到的現金／轉帳合計（例：「你今天收到現金 $2,800，共 4 筆」），讓收款人跟手上的錢對一下。
- 還沒付款的人列在同一處，方便下課逐一收。

## 7. 合併學員

老師端學生詳細頁：「合併到另一位學員」。在同一個 transaction 內：

1. 把來源學員的 `StudentCard`、`AttendanceRecord`、Event、舞種資格移到目標學員。
2. `AttendanceRecord` 撞到 `@@unique([lessonPeriodId, studentId])`（同一堂兩個身分都點了）：保留有綁卡的那筆；另一筆若有扣堂要退回該卡的 `remainingSessions`。列在確認畫面讓老師先看。
3. `lineUserId`：目標沒有就移過去；兩邊都有且不同，由老師選。
4. 來源學員 `archivedAt = now()`，並記錄 `mergedIntoId`（新增欄位）方便追查，不硬刪。
5. 重算 `refreshNeedsRenewalTag()`。

## Schema 變更總表

| 變更 | 用途 |
|---|---|
| `StudentCard.paymentMethod`、`paymentReference` | §5 |
| `Card.isTrial Boolean @default(false)` | §3.1 體驗課：新同學付費、舊生預設免費 |
| `Student.mergedIntoId Int?` | §7 |
| `Student.lineInviteSentAt DateTime?` | §2.1 邀請綁定的發送紀錄 |
| 新 `TodoType.POSSIBLE_DUPLICATE` | §2 新學員與未綁定舊學員同名 |

一律 `npm run db:migrate`，不用 `db push`。

## 建議順序

1. **§5 收款欄位**：最小改動，且水庫串接馬上用得到。
2. **§2.1 未綁定清單＋邀請訊息**：不用等新流程，現在就能開始把舊學員綁好。
3. **§1–§3 LIFF 入口＋新同學＋必選卡＋體驗課**：主要體驗改善。
4. **§4 未付款提醒與標示**。
5. **§6 下課對帳**、**§7 合併學員**。

## 開放問題

1. ~~「舊生」的判斷~~ → **已決定（2026-10-25）：買過任何非體驗課的卡就算**（`src/service/trial.ts`）。
