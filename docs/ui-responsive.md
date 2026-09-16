# 手機／桌面版型架構

> 調查日期：2026-09-15。本文記錄手機版與桌面版分岔的現況、成因，**以後新畫面該怎麼決定版型**的規則，以及可逐項處理的收斂待辦。
>
> 既有的相關決策紀錄：[`architecture.md`](architecture.md) 的「學生頁版面（手機列表 vs 桌面分割檢視）」——那一頁是目前唯一做對的範例，本文把它升格成全專案規則。

## 現況摘要

專案同時跑著**五種手機／桌面分岔機制**，而且沒有任何文件說哪一頁該用哪一種，所以每個畫面都在即興發明。這才是「做 RWD 一直冒出例外狀況」的成因——不是 CSS 難寫。

核心認知：**breakpoint 可以重排版面，但沒辦法把「一頁一步的 drill-down」變成「左右分割的 master-detail」。** 那是資訊架構分岔，不是樣式分岔。

### 五種機制

| 機制 | 代表位置 | 適用時機 | 狀態 |
|---|---|---|---|
| ① `hidden lg:` **雙樹並掛** | `features/lessons/LessonDetail/index.tsx:44-82`、`features/students/StudentDetail/index.tsx:86,106`、`features/lessons/newLesson/index.tsx:175,198`（submit 按鈕寫兩份） | 小塊靜態內容可以，整個畫面不行 | ⚠️ 已造成 bug |
| ② 純 CSS，單一樹 | `features/cards/CardList/index.tsx:208`、`features/lessons/GroupRow.tsx:18-20`（`GROUP_ROW_COLS` + `lg:contents`） | 同一份資訊、換排列 | ✅ 最乾淨 |
| ③ JS size class 切換，只掛一棵 | `app/(main)/students/page.tsx:10,15` + `features/students/StudentsSplitView.tsx` | 資訊架構真的不同 | ✅ 正解 |
| ④ adaptive 元件 | `components/Drawer.tsx:31,38-54`（桌面 centered dialog／手機 bottom sheet，22 個呼叫點） | 同一顆邏輯，換呈現外殼 | ✅ 全專案只有這一個 |
| ⑤ 手機 only，桌面沒設計 | 點名全流程 `PeriodAttendanceForm`（只有 3 個 `md:` padding）、`CheckPeriodSuccess/index.tsx:80`、`teachers`、`teams`、`invitations` | 學生端對，老師後台不對 | ⚠️ 桌面破口 |

### 兩個已經付出的代價（都來自 ①）

**代價一——重複推導，已進 git log。** `LessonDetail/index.tsx` 的手機樹與桌面樹**同時掛載**，`PeriodSection` / `AttendanceOverview` / `SettingSection` 各跑兩次，`AttendanceOverview` 的 `headcountByPeriod` / `attentionItems` / `buildRosterRows` 也是。這就是 `32eaaea fix(lessons): keep the overview's periods array stable across renders` 的由來，修補註解寫在 `AttendanceOverview/index.tsx:30-43`：「Memoised for the identity, not the cost」。

**代價二——持久化狀態撕裂，已繞開並記錄。** `StudentList` 把篩選／排序寫進 `localStorage`（`studentFilters.ts`，key 帶 classroomId），兩棵樹會各自寫。當時的處理是改用 ③，原因寫在 `app/(main)/students/page.tsx:9`：「只掛載其中一棵樹：兩棵都掛的話兩份篩選狀態會各自寫 localStorage 而分岔。」

### 兩個互相衝突的「桌面」定義

| 誰 | 切在哪 | 位置 |
|---|---|---|
| `useIsDesktop()` | **768px**（註解還寫著 "the app's desktop breakpoint"） | `src/hooks/useMediaQuery.ts:25` |
| `useIsWide()` | **1024px** | `src/hooks/useMediaQuery.ts:30` |
| 版型外殼（側邊欄 / BottomNav） | `md:` = **768** | `app/(main)/layout.tsx:11,14` |
| 頁面內容 | `lg:` = **1024**（119 處 vs `md:` 19 處） | 遍佈 `src/features/` |

→ **768–1024px 之間是破的**：有桌面側邊欄，但內容還是手機版。平板直立、分割視窗都落在這段。

而且 768／1024 是**硬編字串**，與 Tailwind 預設的 `md` / `lg` 重複定義，沒有單一真相——`globals.css` 的 `@theme` 只有色彩，沒有 `--breakpoint-*`。

跨 breakpoint 耦合已經出現：`PeriodAttendanceForm/index.tsx:111-114` 的固定底部按鈕用 `md:bottom-0` 去對齊 BottomNav 的 `md:hidden`，兩個檔案必須知道彼此的 breakpoint 才能正確排版。

### 桌面破口清單

- `PeriodAttendanceForm/index.tsx:80` 的 `SubNavbar` **沒有** `lg:hidden` → 桌面同時出現手機綠色 app-bar 和側邊欄。（`newLesson:131`、`GroupDetail:35`、`LessonDetail:38` 都加了）
- `CheckPeriodSuccess/index.tsx:80` 是 `max-w-md mx-auto` → 1920px 上仍是手機寬。
- `PendingStudents.tsx:29-63`：每個待處理學生開一個 480px `Drawer`（`Drawer.tsx:39` 桌面也 cap 480px）→ 桌面解掉 5 個未綁卡學生＝5 次 modal 往返。**手機的互動模型直接搬到桌面就是錯的**，這是最清楚的例子。
- `teachers`、`teams`、`invitations`：零 breakpoint，桌面滿版拉開。

### 量級

- `src/features` + `src/components` 共 **14,450 行**，最大檔 444 行 → 做兩套 app 等於翻倍。
- breakpoint 只有 **151 處 / 31 個檔案** → **收斂比分家便宜一個量級**。這是下面所有決定的前提。
- `src/hooks/` 只有 **1 個檔案**（`useMediaQuery.ts`），全專案沒有其他 custom hook。
- `src/components/` 的 13 個共用元件**零 breakpoint**，全部是手機形狀。
- 有利條件：`app/*/page.tsx` 幾乎都是 8–20 行薄殼；server 邏輯抽得乾淨；三個重點頁的 RTK Query 已經拉到 shell 層（`LessonDetail:25-29`、`cards/[id]/page.tsx:13`、`students/[id]/page.tsx:17`、`StudentsSplitView:53`），葉節點是純 props → **兩個外殼可共用同一份資料層**。
- 「抽純模組 + 寫測試」已有房內先例：`studentFilters.ts`、`cardInsights.ts` + `cardInsights.test.ts`、`calendarUtils.ts`、`EventTimeline.helpers.ts`。

---

## 規則（新畫面照這個走）

### 1. 只有一個 size class 邊界：1024px

版型**模式**的切換點只有一個數字，定義在 `globals.css` 的 `@theme`（`--breakpoint-*`），JS 端由 `useSizeClass()` 讀同一個來源。

其他 breakpoint（`sm:` / `xl:`）只能做**微調**——欄數、padding、字級、要不要顯示某個欄位——**不准做版型模式切換**。

### 2. 邏輯在 hook，版型在外殼

每個畫面一個 hook：資料抓取、選取狀態、驗證、衍生推導。外殼只排版與轉發事件，**不含業務規則**。

判準：**兩個外殼共用超過七成狀態機，就把狀態機抽出來。** 抽完之後第二個外殼通常 100 行左右（`StudentsSplitView` 就是 101 行）。

### 3. 用 `variant` prop，不要平行元件樹

同一個元件用 `variant` / `layout` 多工，是本專案已確立的慣例：`StudentList variant="page"|"roster"`、`StudentDetail layout="auto"|"tabs"`、`StudentDetailHeader variant="page"|"pane"`。

但要小心別讓它變成「把 breakpoint 用 props 重新實作一遍」。判準：**prop 名稱描述的是「用途」（`roster` / `pane`）還是「寬度」（`isDesktop` / `columns`）？** 前者健康，後者是味道（現況：`StudentDetail/index.tsx:50` 的 `columns={isPane ? 2 : 1}`）。

同一個元件要出現在不同寬度的槽位時（例如桌面 480px 抽屜 vs 手機滿版），用 **container query**（Tailwind v4 原生 `@container`，不需 plugin，目前用量為零），讓元件對自己的槽位負責，而不是對整個視窗負責。

### 4. 四個 adaptive primitives，做完 L2 的畫面全部免費

`ResponsiveDialog`、`DataView`（Table↔CardList）、`SplitView`、`StepFlow`（wizard↔單頁分區）。順序上**先做 primitives 再改頁面**，比一頁一頁即興發明便宜得多。

### 5. 逐畫面決定層級，不要全站一刀切

| 層級 | 什麼時候用 |
|---|---|
| **L1** 純 CSS / container query | 資訊架構完全相同，只是空間變多 |
| **L2** adaptive primitive | 資料與流程不變，只有互動容器要換 |
| **L3** 共用 hook + 兩個外殼、只掛一個 | 連「使用者怎麼走完這件事」都不同（wizard vs 單頁、跳頁 vs 分割） |
| **L4** 兩套 app | **不做**，見「已知取捨」 |

現況統計：18 個畫面裡**只有 5 個真的需要 L3**（lesson 詳情、點名、新增課程、學生列表、學生詳情），其餘停在 L1–L2 或刻意不對等。

### 6. device-task fit：不追求每頁對等

桌面版通常**不是「手機版 + 更多空間」**，而是「更少跳頁、更高密度、鍵盤優先、批次操作」。問題不是「這頁桌面版長什麼樣」，而是「這件事主要在哪個裝置上做」。

---

## 待辦清單（逐項處理）

按**成本／效益比**排序，不是按頁面順序。

> **五項全數完成 ✅ 2026-09-16。** 每一項下面都補了實際做法。施工單（`ui-responsive-rollout.md`）已刪除，決策紀錄留在本文。

### [x] 1. 統一 size class 為 1024px ✅ 2026-09-16

只留一個邊界。選 1024 而非 768：內容端已有 119 處 `lg:`，且三欄學生詳情、380px 分割檢視名單本來就需要 ≥1024。

- `src/app/globals.css` 的 `@theme` 加 `--breakpoint-*`，當唯一真相
- `src/hooks/useMediaQuery.ts`：`useIsDesktop()` / `useIsWide()` 合併成 `useSizeClass()`，讀同一個 token
- `src/app/(main)/layout.tsx:11,14`：側邊欄與 BottomNav 從 `md:` 改 `lg:`
- 解掉 `PeriodAttendanceForm/index.tsx:111-114` 的跨 breakpoint 耦合

**驗收**：拉動視窗寬度，側邊欄出現的那一刻內容版型同時切換，中間沒有過渡區間。全專案搜不到硬編的 `768` / `1024`。

**實際做法**：`globals.css` 用 `@theme static { --breakpoint-lg: 1024px }`——`static` 是必要的，
預設會 tree-shake 掉沒被當成 CSS 變數引用的 theme token，而 `useSizeClass()` 要在 runtime
`getComputedStyle` 讀得到它（已實測讀得到）。`useIsDesktop()` / `useIsWide()` 合併成
`useSizeClass()`，回傳 `"compact" | "expanded"`——選字串不選 boolean，是為了哪天真要加
第三個 size class 時呼叫點（`=== "expanded"`）不用全部重寫。`PeriodAttendanceForm` 的跨
breakpoint 耦合現在兩邊都對齊同一個邊界。

**副作用**：`Drawer` 的桌面置中彈窗門檻從 768 升到 1024，所以 768–1024 之間改成顯示底部
抽屜。這是「平板直立歸手機體驗」那個取捨的直接後果，符合預期。

### [x] 2. 把雙樹並掛改成單樹 ✅ 2026-09-16

`LessonDetail/index.tsx`、`StudentDetail/index.tsx`、`newLesson/index.tsx` 改成用 `useSizeClass()` 只掛一棵——沿用 `students/page.tsx` 已驗證的做法。順手拿掉重複的 submit 按鈕與 header。

直接解掉代價一與代價二的根因，不需要任何新設計。

**驗收**：`AttendanceOverview` 的三個 `useMemo` 每次互動只跑一次。手機 DOM 不再包含桌面三欄的節點。

**實際做法**：三個畫面都改成 `useSizeClass()` 二選一渲染。`StudentDetail` 的
`layout="tabs"`（分割檢視右欄）那一支保留不動——它不是版型分岔，是「窄槽位」的呈現。
`newLesson` 順手把寫兩份的 submit 按鈕與 header 收成一份（`DanceTypeSelect` 的下拉 vs
radio group 也是）。

**補完（2026-09-16 同日）**：`StudentDetailHeader.tsx` 的 `hidden lg:block` 已拿掉，
渲染與否改由 `app/(main)/students/[id]/page.tsx` 的 `useSizeClass()` 決定——`compact`
掛綠色 app-bar、`expanded` 掛 `StudentDetailHeader`，一次只有一個。手機因此不再 mount
那份看不見的 `EditStudent`（8 個 `useState`）。`variant="pane"` 那一支不受影響。

**`GroupDetail.tsx:35,38` 重新判定為不用改**：它的兩份頁首（`SubNavbar` 與桌面
`hidden lg:flex` 的 `ArrowLeft` + `h1`）內部都沒有 hook 或狀態——`SubNavbar.tsx` 整檔零
hook——正好落在下面「已知取捨」寫的界線內：小塊靜態內容用 `hidden lg:` 是可以的。

### [x] 3. 抽 screen hook ✅ 2026-09-16

- `useAttendanceFlow()` — 吃掉 `PeriodAttendanceForm/index.tsx:22-34,69-74` 的取資料、選取狀態與推導。**這是第 5 項的前置條件。**
- `useLessonsList()` — 吃掉 `LessonsList.tsx:20-101` 的群組彙總（`summarizeGroup`）與 view-mode 規則（`isFlattened` / `useGroupedView`）。

照 `studentFilters.ts` / `cardInsights.ts` 的先例（純模組 + 單元測試）。

**驗收**：新 hook 有對應 `*.test.ts`；元件裡不再有 `useMemo` 包業務推導。

**實際做法**：`useAttendanceFlow`（放 `src/hooks/`，因為桌面點名是另一個外殼、要 import
同一顆）與 `useLessonsList`（放 feature 資料夾）。純推導照 `cardInsights.ts` 的先例另外抽成
`src/hooks/attendanceFlow.ts`（14 測試）與 `src/features/lessons/lessonGrouping.ts`（19 測試）。
`PeriodAttendanceForm` 的 `useState`/`useEffect`/`useMemo` 歸零；`LessonsList` 只剩
`createGroupOpen` 這個純 UI 開關。

順手修掉兩個既有小 bug（有測試蓋住）：`filterByKeyword` 會 trim 關鍵字（原本只打空白會
濾掉整份名單）、`selectStudents` 明確維持原始順序。

**注意**：`npx vitest run` 仍然需要本機 docker Postgres——`vitest.config.ts` 的 `globalSetup`
對任何 vitest 呼叫都會跑 migrate，純單元測試也躲不掉。要免 DB 得拆 vitest projects。

### [x] 4. 建四個 adaptive primitives ✅ 2026-09-16

- **ResponsiveDialog** — 把 `components/Drawer.tsx` 拆成通用容器 ＋ 桌面 dialog／手機 sheet。現在的 `Drawer` 自帶 submit 按鈕，不是通用容器。可考慮補 `@radix-ui/react-dialog` 拿 focus trap，同時修掉 `components/ConfirmDialog.tsx` 手寫 portal 沒有 focus 管理的問題。
- **DataView** — Table ↔ CardList，收掉 `GroupRow` 的 11 處 `lg:`。`GROUP_ROW_COLS` + `lg:contents` 的寫法值得抽成通用能力，而不是只服務課程群組。
- **SplitView** — 把 `StudentsSplitView` 的外殼（含網址鏡射、↑↓／`/`／Enter 鍵盤操作）抽成可重用元件。
- **StepFlow** — wizard ↔ 單頁分區，給 `newLesson`（順帶處理 `AddPeriodForm` 已存在兩份的問題：`newLesson/AddPeriodForm.tsx` 與 `PeriodSection/AddPeriodForm.tsx`）。

**驗收**：`src/components/` 開始出現 breakpoint / container query，而 `src/features/` 的 `lg:` 總數下降。

**實際做法**：四個都做了，另外多一個 `ExpandableAction`（第 5 項要用）。

- **ResponsiveDialog** — 裝了 `@radix-ui/react-dialog`。`Drawer` 變成薄包裝，22 個呼叫點
  一行沒改；`ConfirmDialog` 換掉手寫 portal，拿到 focus trap / Esc / scroll lock / focus 歸位。
  ⚠️ **不要改回 framer-motion 的 `AnimatePresence` + `forceMount`**：那是網路上最常見的
  Radix + framer-motion 組合，但在這個專案（React 19 / framer-motion 12）實測是壞的——
  退場動畫跑完後節點不會被移除，留下一層 `opacity: 0` 的全螢幕遮罩把後續點擊全部吃掉。
  現在用 Radix 原生的 `data-state` + CSS keyframes（`globals.css` 的 `rd-*`），
  由 Radix 的 Presence 等 `animationend` 再卸載。已在瀏覽器實測 Esc 與點遮罩都能關乾淨。
- **DataView** — 維持 `lg:contents` 的純 CSS 單樹寫法。grid track 沒辦法用 Tailwind class
  動態產生，改用 CSS 變數傳，但切換點仍走 `lg:`。`GroupRow` 的 `lg:` 從 11 降到 2。
- **SplitView** — 版面 ＋ `useSelectionMirroredToUrl`。網址鏡射行為原封不動搬過去
  （仍然只用 `useSearchParams` **讀**、複製進 state、用 `history.replaceState` 寫回）。
  鍵盤操作這輪留在 `StudentList`。
- **StepFlow** — 注意它**沒有**真的做出「一頁一步」的 wizard：`newLesson` 現在手機是單頁
  往下捲，這輪是機制置換不是改設計，所以抽的是現況（分區容器）。要做分步流程是另一件事。

`src/components/` 從零 breakpoint 變成有 breakpoint（DataView 10 處），`src/features/` 的
`lg:` 從 119 降到 45——文件當初設的驗收方向達成。

### [x] 5. 補桌面點名 ✅ 2026-09-16

其他項目都是搬程式碼，這一項是設計問題。

點名三個 route（`check` / `check-success` / `check-edit`）在手機是正確的一頁一步；桌面應收成 lesson 頁內的面板或一張 roster 表格，把 `PendingStudents` 的五次 modal 往返換成就地解決。Next.js 的 intercepting route 可讓同一個網址在手機是整頁、桌面是覆蓋在名單上的面板——呈現交給 `ResponsiveDialog` 決定，與 `Drawer` 現在做的事同一招。

順手修：`PeriodAttendanceForm/index.tsx:80` 的 `SubNavbar` 補 `lg:hidden`、`CheckPeriodSuccess/index.tsx:80` 拿掉 `max-w-md`。

**驗收**：桌面解決 5 個未綁卡學生不需要開關 5 次 modal；桌面不再同時出現手機 app-bar 和側邊欄。

**實際做法（方向由使用者拍板）**：**沒有**採用 intercepting route。三個 route 維持整頁，
網址、深連結、返回鍵語意全部不變，只是換上桌面版面——理由是 parallel route + `default.tsx`
+ 硬重整 fallback 的機器太多，而收益（桌面不離開課程詳情）對單人教室工具不成比例。

- `PeriodAttendanceForm` 桌面改兩欄：左邊搜尋＋名單、右邊已選清單與送出按鈕（sticky）。
- 兩個畫面的 `SubNavbar` 都改成只在 compact 渲染，桌面不再同時出現手機 app-bar 與側邊欄。
- `CheckPeriodSuccess` 從 `max-w-md` 放寬到 `lg:max-w-3xl`（手機維持窄欄——那是逐列清單，
  全寬拉開反而難讀）。
- `PendingStudents` 用新的 `ExpandableAction`：手機維持 `Drawer`、桌面就地展開。
  解 5 個未綁卡學生不再需要開關 5 次彈窗。展開面板靠 `w-full` ＋ 父層 `flex-wrap`
  換到自己那一行。

---

## 已知取捨（刻意不做，別再重複討論）

- **不做兩套 app／`m.` 子網域。** 14,450 行翻倍成 ~29,000 行，路由、auth、狀態、QA 全部翻倍然後開始 drift，換到的只是「不用想清楚規則」。web 上這條路已被業界淘汰。
- **不追求每頁桌面對等。** `teachers`、`teams`、`invitations` 維持窄欄居中，它們不是每天用的畫面。
- **學生端維持純手機 480px。** `liff/*`、`checkin/[key]`、`public-students/[randomKey]` 本來就只在手機開，不是技術債。`checkin-qr` 刻意窄（現場投影用）。
- **平板直立（768–1024）歸手機體驗。** 這是第 1 項的代價，明確接受。真的出現 iPad 使用者再加第三個 size class。（業界完整做法是多個 size class——Material 3 定義五個：compact <600 / medium 600–840 / expanded 840–1200 / large / extra-large；簡化成兩個是小型工具的合理取捨，但要知道自己在簡化。）
- **小塊靜態內容用 `hidden lg:` 是可以的**（例如 `CardDetail:80` 的桌面返回連結、`GroupRow:65-76` 的桌面表頭）。界線是：**裡面有沒有 hook 或狀態。**
- **JS 切換的首屏閃動先接受。** `useMediaQuery.ts:10` 在 server 與 client 首次 render 都回 `false`（避免 hydration mismatch 的正確設計），代價是桌面先畫手機版再切換。緩解首選「首屏給 skeleton」，不值得為此改成 cookie / UA hint。

---

## 調查指令備忘

```bash
# breakpoint 總量與分佈
grep -rEoh --include="*.tsx" "\b(sm|md|lg|xl|2xl):" src | sort | uniq -c | sort -rn
grep -rEc --include="*.tsx" "\b(sm|md|lg|xl|2xl):" src | grep -v ':0$' | sort -t: -k2 -rn

# 找出所有雙渲染／單邊顯示的位置
grep -rn --include="*.tsx" "hidden \(md\|lg\|sm\):\|\(md\|lg\):hidden" src

# JS 端 viewport 偵測的所有呼叫點
grep -rn --include="*.ts" --include="*.tsx" "useIsDesktop\|useIsWide\|useMediaQuery\|matchMedia" src

# 殘留的手機寬度夾制
grep -rn --include="*.tsx" "max-w-\[480px\]\|max-w-md" src

# UI 程式碼量級
find src/features src/components -name "*.tsx" | xargs wc -l | tail -1
```
