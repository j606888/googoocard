# Design System 調查與待辦

> 調查日期：2026-06-20。本文記錄目前色彩 token 與共用元件的現況、問題，以及可逐項處理的待辦清單。

## 現況摘要

專案有設計系統的基礎，但分裂成**兩套互相衝突的色彩系統**，且大量畫面直接寫死顏色未走 token。元件也分成「手刻」與「shadcn」兩派並存。

### 兩套色彩 token

**(A) 品牌層** — `src/app/globals.css` 的 `@theme`，真正的品牌 DS：
- 綠色 `--color-primary-50 → --color-primary-900` 完整色階
- `--color-warning-100 → --color-warning-900`
- 使用廣泛：`bg-primary-500` 87 次、`bg-primary-50` 37 次、`bg-primary-600` 26 次…
- 手刻元件（`src/components/*`）都吃這套。

**(B) shadcn 層** — `@theme inline` + `:root` 的 oklch 變數 + `src/components/ui/*`：
- `--primary`、`--secondary`、`--muted`、`--accent`… 是 shadcn 預設的**灰階**中性色
  （`--primary` ≈ oklch 0.205，接近黑，**不是**品牌綠）
- 對應 `src/components/ui/button.tsx`、`calendar.tsx`、`popover.tsx` 等
- 幾乎沒在用：語意版 `bg-primary` 僅 5 次、`bg-secondary` 2 次。

⚠️ **核心衝突**：兩套都叫 `primary`，但 (A) 是綠、(B) 是灰黑。`tailwind.config.ts` 幾乎空白（只設字體），token 全靠 CSS 變數，兩套來源未對齊。

### 元件分裂成兩派

| 來源 | 例子 | 風格 |
|---|---|---|
| 手刻 `src/components/*` | `Button.tsx`、`InputField.tsx`、`Drawer`、`Menu`、`MultiSelect`… | 字串拼 className、吃品牌 `primary-*` |
| shadcn `src/components/ui/*` | `button.tsx`、`calendar.tsx`、`popover.tsx`、`switch.tsx`、`sonner.tsx`、`skeleton.tsx` | `cva` 變體、吃 oklch 語意 token |

光 Button 就有兩個：`components/Button.tsx`（自製，`outline` boolean）vs `components/ui/button.tsx`（shadcn，`variant`/`size`），API 與外觀皆不同。

### 硬編色現況

- `gray-*` 工具類用了 **451 次**
- **81 個 `.tsx`** 直接用 tailwind 預設色（gray/green/red/blue…）
- **11 處**直接寫 hex
- 主因：品牌 `@theme` **只有 primary/warning，沒有中性灰階與錯誤色 token**，所以大家回頭用 `gray-100`、`text-red-500` 這類預設值（如 `InputField` 的 `bg-gray-100`、錯誤字 `text-red-500`）。

---

## 待辦清單（逐項處理）

### [x] 1. 統一 primary 定義 ✅ 2026-06-20
把 shadcn 的 `--primary` / `--primary-foreground` 指到品牌綠，消除「兩個 primary」的衝突。
- 檔案：`src/app/globals.css`
- 已做：
  - `:root` → `--primary: var(--color-primary-500)`、`--primary-foreground: #ffffff`
  - `.dark` → `--primary: var(--color-primary-400)`、`--primary-foreground: var(--color-primary-900)`
  - `--destructive` 一併指向 danger token（light: `--color-danger-500`、dark: `--color-danger-400`）
- 影響範圍：語意 `bg-primary`/`text-primary` 只在 `ui/button.tsx`（default & link 變體）、`ui/calendar.tsx`（選取日）使用 → 現在皆為品牌綠。
- 驗證：`npm run build` 通過；產出 CSS 中 `--primary` 正確解析為 `var(--color-primary-500/400)`。

### [x] 2. 補齊中性 / 語意 token ✅ 2026-06-20
新增中性灰階（neutral-*）與錯誤色（danger-*）token，讓 451 次 `gray-*` 與 `red-*` 有官方替代。
- 檔案：`src/app/globals.css` 的 `@theme`
- 已做：新增 `--color-danger-50..700`（值對齊 Tailwind `red-*`）與 `--color-neutral-50..900`（值對齊 Tailwind `gray-*`）。
  → 第 5 項把 `*-red-*` / `*-gray-*` 換成 `*-danger-*` / `*-neutral-*` 時為**視覺零變動**。
- 備註：Tailwind v4 為按需輸出，尚未被任何 utility 使用的 token 不會預先 emit 到 `:root`，待第 5 項實際使用時才產生，屬正常行為。

### [x] 3. 統一 Button ✅ 2026-06-20
收斂成單一 Button，保留 shadcn `cva` 版（API 較完整、default 變體已是品牌綠）。
- 已做：
  - `src/components/ui/button.tsx` 補上自製版獨有的 `isLoading` prop（loading 時自動 `disabled`，沿用 shadcn 既有 `disabled:opacity-50` 視覺）。
  - 4 個呼叫點全部改 import `{ Button } from "@/components/ui/button"`，並補 `w-full` 還原原本全寬：
    `features/income/RecordsTab.tsx`、`features/lessons/newLesson/index.tsx`（2 處）、
    `features/lessons/LessonDetail/PeriodAttendanceForm/index.tsx`、`.../SettingSection/index.tsx`。
  - 刪除 `src/components/Button.tsx`（自製版的 `outline` prop 全專案未使用，安全移除）。
- 視覺差異（刻意收斂到 DS 按鈕）：字重 semibold→medium、高度 auto(py-2)→`h-9`、圓角 `rounded`→`rounded-md`。
- 驗證：`npm run build` 編譯成功，無殘留 `@/components/Button` 引用。

### [x] 4. 統一 InputField / 表單元件 ✅ 2026-06-20
讓手刻**表單輸入**元件走 token（背景灰、錯誤色），不再硬編 `gray-*` / `red-*`。
- 已做（`gray-*`→`neutral-*`、`red-*`→`danger-*`，值對齊故視覺零變動）：
  - `InputField.tsx`：`bg-gray-100`→`bg-neutral-100`、錯誤 `border/text-red-500`→`-danger-500`
  - `TimePicker.tsx`：trigger 與選項的 `gray-100/200/400/700` → `neutral-*`
  - `MultiSelect.tsx`：錯誤 `border/text-red-500`→`-danger-500`、`text-gray-500`/`bg-gray-100`→`neutral-*`
  - `RoundCheckbox.tsx`：`border-gray-300`/`bg-gray-100`→`neutral-*`
- 驗證：`npm run build` 成功，CSS 確認 `neutral-*`/`danger-*` token 已 emit 且 utility 正常產生。
- 待第 5 項處理的殘留：`MultiSelect.tsx` 仍有 hex `border-[#E4E8E8]`、`text-[#A9AEB1]`（不在現有色階內，刻意保留待統一處理）。`DatePicker.tsx` 本來就無硬編色。

### [~] 5. 收斂硬編色與 hex（大宗已完成，剩判斷項待確認）

**已完成（2026-06-20，視覺零變動）**：全專案 75 個 tsx 檔，`-gray-<n>`→`-neutral-<n>`、`-red-<n>`→`-danger-<n>`（共 ~465 處）。`npm run build` 通過。

**待設計決定的剩餘項**（不在現有色階／屬品牌例外，刻意未動）：

1. `green-*`（28 處）— 語意上是「成功」狀態色，但 Tailwind green ≠ 品牌綠（`primary`）。
   選項：新增 `success-*` token 並替換 / 直接併入 `primary-*`（會變色）/ 維持現狀。
2. `amber-*`（20 處）— 語意上是「警示」，與現有 `warning-*`（僅 100/500/600/900）部分對應但色階不足、色相也不完全一致。
   選項：擴充 `warning-*` 色階並替換 / 維持現狀。
3. Hex：
   - `#06C755`（×2，`StudentLineBind`/`LineBindButton`）— **LINE 官方品牌綠，建議保留**（可抽成具名常數）。
   - `#55BD95`（`CheckPeriodSuccess` 的 `<PulseLoader color>`）— 其實就是 `primary-500`，但用在 JS prop 非 className；可改引 CSS 變數或常數。
   - 色階外雜灰：`#999999`、`#444444`、`#848484`（SidebarContent/UnpaidBell）、`#E4E8E8`、`#A9AEB1`（MultiSelect）、`#D4EDE4`（淺綠裝飾圓 app/page）。
     選項：就近 snap 到最接近的 `neutral-*`/`primary-*`（會有微小色差）/ 維持現狀。

---

## 調查指令備忘

```bash
# 品牌 primary-* token 使用次數
grep -rEho "(bg|text|border)-primary-[0-9]+" src --include="*.tsx" | sort | uniq -c | sort -rn

# 硬編灰階次數
grep -rEho "(bg|text|border)-gray-[0-9]+" src --include="*.tsx" | wc -l

# 用 tailwind 預設色的檔案數
grep -rlE "(bg|text|border)-(gray|green|red|blue|orange|slate|zinc)-[0-9]" src --include="*.tsx" | wc -l

# 直接 hex 色
grep -rEho "#[0-9a-fA-F]{6}" src --include="*.tsx" | wc -l
```
