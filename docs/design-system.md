# Design System

> 2026-10-26 定案，以登入頁（`src/app/(auth)`）、首頁、學生頁改版為準。設計稿：https://claude.ai/artifact/8R7oCFaDQi9XyGUpU4427F
> 舊的調查紀錄在 `docs/design-system-audit.md`（gray→neutral 等 token 收斂，已完成）。

原則：**深綠是行動，淺綠是狀態，灰階負責其他一切**；同一件事只有一種畫法。寫新畫面先找下面的共用元件，沒有才手刻，手刻也只能用這裡列的 token。

## 顏色

Token 全在 `src/app/globals.css` 的 `@theme`。

### 品牌綠 `primary-*`

| token | 用途 |
|---|---|
| `primary-900` #1B5E4A | 主要按鈕、選取中的 chip、強調文字。**白字只能放在 900 上** |
| `primary-700` #2B8E6E | hover、連結、圖示、focus 框 |
| `primary-600` #4BB38B | 分頁底線、進度條 |
| `primary-500` #55BD95 | 純裝飾填色（插圖、圖表）；**不放文字、不當按鈕底** |
| `primary-400` | 少用；不當文字色（對比不足） |
| `primary-300` #A7E1CB | 次要按鈕框線、虛線、插圖 |
| `primary-100` #E3F7F0 | 正向徽章底、選取列、側欄選取項 |
| `primary-50` #F1FAF6 | 頁面淡底、插圖圓底、說明提示區 |

### 灰階 `neutral-*`

| token | 用途 |
|---|---|
| `neutral-900` | 標題、主要文字 |
| `neutral-700` | 按鈕文字（ghost）、chip 文字 |
| `neutral-600` | 次要文字、內文 |
| `neutral-500` | 說明、表頭、時間、計數——**最淺的文字色** |
| `neutral-400` | placeholder、停用；不放正文 |
| `neutral-300` | 輸入框、chip 框線 |
| `neutral-200` | 卡片、表格框線、分隔線 |
| `neutral-100` | 骨架、分段切換底、灰色徽章底 |
| `neutral-50` | 表頭底、停用輸入框底 |

不要用 shadcn 的語意灰（`bg-accent`、`bg-muted`、`text-muted-foreground`、`border-border`…），也不要用 Tailwind 預設色（`gray-*`、`sky-*`、`blue-*`…）。

### 語意色：一律「淡底＋深字」成對

| 語氣 | 底 | 字 | 框線／實心 |
|---|---|---|---|
| 正向／成功 | `primary-100` | `primary-900` | — |
| 提醒（品牌橘） | `warning-100`／`warning-50` | `warning-950` | `warning-300` |
| 危險／錯誤 | `danger-50` | `danger-700` | `danger-200` 框、`danger-600` 實心 |

- 「成功」用品牌綠，**不用 `success-*`**（那是 Tailwind 綠，跟品牌綠撞色；保留 token 只為了舊程式能編譯）。
- 錯誤文字用 `danger-700`，不用 `danger-500`（對比不足）。
- 例外：LINE 綠 `#06C755` 只用在 LINE 標誌與按鈕；舞種顏色走 `danceStyleMeta()`；老師／舞種色盤走 `DANCE_STYLE_PALETTE`。

## 圓角

注意本專案的 `rounded-sm/lg/xl` 被 shadcn 的 `--radius` 改過，數值如下：

| class | px | 用途 |
|---|---|---|
| `rounded-sm` | 6 | 小徽章（非膠囊）、勾選框 |
| `rounded-[3px]` | 3 | 例外：20px 以下的出席／熱度方格（6px 會把方格變成圓點） |
| `rounded-lg` | 10 | 小按鈕（`sm`）、分段切換內的按鈕、選單項 |
| `rounded-xl` | 14 | 按鈕、輸入框、分段切換外框 |
| `rounded-2xl` | 16 | 卡片、表格、面板、彈窗 |
| `rounded-t-[28px]` | 28 | 手機底部白色面板（登入頁） |
| `rounded-full` | — | chip、狀態標籤、頭像、骨架文字列 |

**不用**：`rounded`（4px）、`rounded-md`（8px）、`rounded-3xl`、其他任意值（插圖除外）。

## 字級

字體 Poppins＋系統中文字。

| 名稱 | 大小／字重 | 用途 |
|---|---|---|
| 展示 | 44–60 / 900 | 首頁、登入品牌區 |
| 標題一 | 28–32 / 900 | 登入頁、手機深綠頁首 |
| 標題二 | `text-2xl` 24 / 700 | 頁面標題（課程、學生） |
| 標題三 | `text-lg` 18 / 700 | 區塊、彈窗、抽屜標題 |
| 內文 | `text-base` 16 | 輸入框文字、主要內文 |
| 列表 | `text-sm` 14 | 列表內文、按鈕 sm |
| 說明 | `text-[13px]` 13 / 500 | 說明、表頭、錯誤訊息 |
| 徽章 | `text-xs` 12 / 600 | 狀態標籤 |

## 尺寸與間距

- 控制項高度三種：`h-9` 36（電腦表格內的小操作）、`h-11` 44（預設，觸控最小值）、`h-13` 52（手機主要按鈕）；單行輸入框 `h-12` 48。不用 `h-8`、`h-10`。
- 間距用 4 的倍數：4、8、12、16、24、32、48。
- 頁面左右留白：手機 16、電腦 32（或 40）。
- 卡片用框線（`border-neutral-200`），**不加陰影**；陰影只給浮起來的東西（選單、popover、彈窗、抽屜）。

## 元件

| 元件 | 檔案 | 什麼時候用 |
|---|---|---|
| `Button` | `src/components/ui/button.tsx` | 所有按鈕。`variant`：`primary`／`secondary`／`ghost`／`danger`／`dangerSecondary`／`link`；`size`：`sm`／`md`／`lg`／`icon`／`iconSm`；`isLoading` 會轉圈並停用 |
| `Field` | `src/components/Field.tsx` | 有標籤的文字輸入（含密碼顯示切換）。`fieldControlClass(error)` 給下拉、日期、時間的觸發框和 textarea 用同一個外觀；`FieldLabel`、`FieldError` 給自己組的欄位 |
| `InputField` | `src/components/InputField.tsx` | 舊 API，內部已是 `Field`；新程式直接用 `Field` |
| `EmptyState` | `src/components/EmptyState.tsx` | 空狀態，三種 `kind`（見下） |
| `Skeleton` | `src/components/ui/skeleton.tsx` | 載入中（見下）。每個列表在自己的檔案旁邊畫一個跟真列同形狀的骨架（例：`StudentTableSkeleton`、`LessonTableSkeleton`） |
| `StatusTag` | `src/components/StatusTag.tsx` | 狀態標籤：`positive`／`warning`／`danger`／`neutral`／`outline` |
| `FilterChip` | `src/components/FilterChip.tsx` | 可切換的篩選膠囊 |
| `SegmentedTabs` | `src/components/SegmentedTabs.tsx` | `pill` 切檢視、`underline` 切分頁 |
| `DataView` | `src/components/DataView.tsx` | 手機卡片＋電腦表格的列表 |
| `TimePicker` | `src/components/TimePicker.tsx` | 時間：早上／中午／下午／晚上／凌晨分頁＋時間格 |

### 按鈕

- 一個畫面最多一顆 `primary`。
- 危險動作先用 `dangerSecondary`；確認對話框裡才用實心 `danger`。
- 只有圖示的按鈕一定要 `aria-label`。

### 空狀態

| kind | 時機 | 內容 |
|---|---|---|
| `page` | 什麼都還沒有（還沒有課程） | 奇異鳥插圖＋標題＋一句「建好之後能做什麼」＋主要按鈕 |
| `filtered` | 搜尋／篩選沒有結果 | 放大鏡＋「沒有符合「X」的…」＋「清除篩選」（`secondary` `sm`） |
| `inline` | 卡片或分頁裡的一小塊沒資料 | 虛線框一行字，可帶圖示 |

不要淡綠底框、不要大圓圈圖示。

### 骨架

1. 已知的東西照常畫：標題、搜尋框、篩選、表頭都是真的，只有資料是骨架。
2. 形狀跟真的一樣：頭像是圓、徽章是膠囊、方格是方格，資料進來不會跳。
3. 寬度有變化、越下越淡：大約 5 列，最後幾列 `opacity-50`／`opacity-25`。
4. 一種顏色、一種動畫：`Skeleton`（預設 neutral-100＋掃光，深色底可用 `bg-*` 換底色）；不要 `animate-pulse`、不要自己寫灰塊。

### 表單

- 標籤在上（`text-sm font-medium`），錯誤在下（`text-[13px] text-danger-700`），用 `aria-describedby` 連起來。
- 用真的 `<form onSubmit>`，Enter 就能送出。
- 白底框線輸入框；**不用灰底** `bg-neutral-100` 輸入框。
