# Googoocard 系統架構

> 最後更新：2026-06-11（複習卡資格系統重構後）

Next.js 15 App Router 全端應用，管理舞蹈教室的課程、學生、點名與課卡收入。
Mobile-first（UI 最大寬度 480px），桌面版另有 `lg:` breakpoint 佈局。

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
├── Student ──┬── StudentCard（學生持有的課卡實例：remainingSessions / expiredAt）
│             ├── StudentDanceQualification（學生 × 舞種的 Lv1 資格，可買/用複習卡）
│             ├── StudentTag ── Tag（自由標籤；"Needs Renewal" 為系統自動維護）
│             └── Event（學生事件日誌：簽到、買卡、課卡用完）
├── Card（課卡種類：價格/堂數；isPracticeCard + danceType 定義複習卡）
├── Teacher（教室內的老師實體，不是 User）
└── Lesson（danceType + status inProgress/finished）
    ├── LessonCard（此課程接受哪些課卡）
    ├── LessonTeacher
    ├── LessonPeriod（單堂時段；attendanceTakenAt 標記已點名）
    │   └── AttendanceRecord（學生 × 時段 ×（可選）StudentCard；建立扣堂、移除退堂）
    └── LessonStudent（首次點名時 upsert 的修課關係）
```

要點：

- `Lesson.status` 由 `refreshLesson()`（`src/service/lesson.ts`）在每次點名操作後重算。
- `DanceType` enum：`BACHATA / SALSA / ZOUK / HUSTLE / KIZOMBA`（新增舞種見下節）。
- `Card.danceType`：複習卡（`isPracticeCard=true`）必填；一般卡為 `null`。
  重構前建立的複習卡可能是 `null`（legacy），系統各處有對應的 fallback 行為。

## 複習卡資格系統

**目的**：複習卡較便宜，只有完成某舞種 Lv1 的學生可購買/使用；
同時避免符合資格的學生在複習課誤用較貴的一般卡。

### 單一真相：`src/domains/qualification/index.ts`

純函式模組（不 import prisma），**前後端共用**，所有資格判斷都必須走這裡：

| 函式 | 用途 |
|---|---|
| `isQualified(quals, danceType)` | 學生是否有某舞種資格 |
| `requiredDanceTypeFor(card, lessonDanceType?)` | 複習卡所需舞種 = `card.danceType ?? lesson.danceType ?? null` |
| `canUseCard(card, quals, lessonDanceType)` | 點名/扣堂情境（一定有課程上下文） |
| `canBuyCard(card, quals, lessonDanceType?)` | 購買情境；失敗回 `NOT_QUALIFIED` 或 `UNKNOWN_DANCE_TYPE` |
| `cardMatchesLesson(card, lessonDanceType)` | 複習卡能否掛到課程（null = legacy 通用，可掛任何課程） |

### UI 集中設定：`src/lib/danceTypes.ts`

`DANCE_TYPE_META`：每個舞種的 label 與 Tailwind 顏色（badge/dot/border…）。
所有徽章、篩選 chip、選擇器都由 `ALL_DANCE_TYPES` 迴圈產生。

### ⭐ 新增舞種只需兩步

1. `prisma/schema.prisma` 的 `DanceType` enum 加值 + 建 migration（`ALTER TYPE ... ADD VALUE`）
2. `src/lib/danceTypes.ts` 的 `DANCE_TYPE_META` 加一筆 label + 顏色

其餘（資格授予、買卡驗證、點名優先、UI 徽章與篩選）全部自動生效，零邏輯修改。

### 驗證矩陣

| 情境 | 行為 | 位置 |
|---|---|---|
| 不符資格買複習卡 | **硬擋**：API 403 `STUDENT_NOT_QUALIFIED` + UI disable | `api/students/[id]/student-cards` POST、`BuyCard.tsx`、`BuyAndUseForm.tsx` |
| legacy 複習卡（無舞種）在學生頁購買 | 擋：API 422 `CARD_MISSING_DANCE_TYPE`（無課程上下文無法驗證）；課程內買卡帶 `lessonId` 則用課程舞種驗證 | 同上 |
| 符合資格者在複習課買/用一般卡 | **軟擋**：UI 預設鎖定一般卡，老師可點「手動切換覆蓋」放行 | `BuyAndUseForm.tsx`、`ChooseCardForm.tsx` |
| 課程掛上舞種不符的複習卡 | 擋：API 400 `PRACTICE_CARD_DANCE_TYPE_MISMATCH`（含卡名）+ UI 選單過濾 | `api/lessons` POST/PUT、`CardSelect.tsx` |
| 建/改複習卡未填舞種 | 擋：API 400 `PRACTICE_CARD_REQUIRES_DANCE_TYPE` + UI 必填驗證 | `api/cards` POST/PATCH、`NewCard/EditCard.tsx` |
| 手動消耗任意卡（consume） | **不擋**——老師永遠可手動消耗，確保 legacy/特殊情況可處理 | consume route |

## 點名流程

入口：`src/app/api/lessons/[id]/periods/[periodId]/attendance/route.ts`
邏輯：`src/domains/attendance/attendance.service.ts`

### 自動選卡（POST/PUT 點名時，`selectStudentCard`）

1. **複習卡優先**：課程掛有複習卡、且學生具該卡所需舞種資格 → 強制從學生的可用複習卡中選
2. 否則過濾出學生「可用」的卡（`canUseCard`，不符資格的複習卡被排除）——**恰好一張**才自動選，多張不選（留待人工）
3. 推薦排序：剩餘堂數最少 → 到期日最早 → id 最小（`getRecommendedStudentCard`）
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

## 買卡流程（StudentCard 建立）

兩個入口，同一個 API（`POST /api/students/[id]/student-cards`）：

1. **學生詳細頁** `BuyCard.tsx` — 無課程上下文，複習卡用 `card.danceType` 驗證
2. **點名頁「買卡並使用」** `BuyAndUseForm.tsx` — 帶 `lessonId`，legacy 卡 fallback 用課程舞種；買完立即 consume

買卡會建立 `Event`（購買課卡）並刷新 Needs Renewal tag。

## Tag 系統

- `Tag` / `StudentTag`：教室層級的自由標籤，學生編輯頁可增刪。
- **"Needs Renewal"** 由系統自動維護（`src/service/studentTag.ts` 的
  `refreshNeedsRenewalTag`）：學生最新一張多堂卡用完 → 自動加 tag，買新卡/退堂 → 自動移除。
  觸發點：點名、買卡、退卡。**不要手動增刪這個 tag 的邏輯**，改 `computeNeedsRenewal` 即可。

## API 慣例

- 所有 handler 用 `decodeAuthToken()` 取 `{ userId, classroomId }`（JWT cookie）。
- Middleware（`src/middleware.ts`）保護除 `/`、`/login`、`/signup`、`/invitations`、`/api`、`/public-students` 外的所有路由。
- 前端資料層全部走 RTK Query（`src/store/slices/`，一 resource 一檔），
  mutation 用 tag invalidation 同步 UI（`TAG_TYPES` 在 `store/api.ts`）。
- 學生 API 回傳的 `danceQualifications` 是扁平的 `DanceType[]`（不是 join table 物件）。
- PATCH student 時 `danceQualifications` 為 `undefined` → 不動資格（保護舊 client）；
  給陣列 → 整組同步（transaction 內 delete notIn + createMany skipDuplicates）。

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

- **`.env` 的 `DATABASE_URL` 直接指向 production RDS。**
  任何 prisma 指令若不明確覆寫 DATABASE_URL 就會打到正式環境。
  本地 DB：`postgresql://postgres:password@localhost:54330/googoocard?schema=public`
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
