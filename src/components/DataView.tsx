"use client";

import { cn } from "@/lib/utils";

/**
 * 同一份 DOM，手機是卡片、桌面是表格。
 *
 * 作法沿用 `GroupRow` 原本的寫法（這個元件就是把它抽成通用能力）：
 * 手機把中間幾格包進一個會換行的 meta 行，桌面用 `lg:contents` 把那層
 * 包裝溶掉，讓每一格直接落進自己的表格欄位。**純 CSS，不換樹**，
 * 所以不會有兩棵樹並掛的重複渲染問題。
 *
 * 欄寬用 CSS 變數傳（grid track 沒辦法用 Tailwind 的 class 動態產生），
 * 但切換點仍然走 `lg:`，讀的是 `--breakpoint-lg` 那個唯一真相。
 */
export interface DataViewColumn<T> {
  key: string;
  /** 桌面表頭的標題。 */
  header: string;
  /** 桌面的 grid track，例如 `"132px"` 或 `"minmax(0,2.2fr)"`。 */
  width: string;
  /**
   * 手機上這一格擺哪：
   * - `primary`  —— 第一列左邊，主要識別（每個 DataView 剛好一個）
   * - `trailing` —— 第一列右邊，狀態或動作（至多一個）
   * - `meta`     —— 第二列那條會換行的 meta 行（預設）
   */
  role?: "primary" | "trailing" | "meta";
  /** 手機上顯示在值前面的小標；桌面由表頭負責，所以不重複顯示。 */
  mobileLabel?: string;
  /** 這一列的這一格在手機上要不要整格藏起來（例如空值時）。 */
  hideOnMobile?: (row: T) => boolean;
  render: (row: T) => React.ReactNode;
}

const Cell = <T,>({
  column,
  row,
}: {
  column: DataViewColumn<T>;
  row: T;
}) => (
  <div
    className={cn(
      "flex items-center gap-1.5 min-w-0 text-xs lg:text-sm text-neutral-700",
      column.hideOnMobile?.(row) && "max-lg:hidden"
    )}
  >
    {column.mobileLabel && (
      <span className="lg:hidden text-neutral-400 shrink-0">
        {column.mobileLabel}
      </span>
    )}
    {column.render(row)}
  </div>
);

const DataView = <T,>({
  columns,
  rows,
  rowKey,
  onRowClick,
  className = "",
}: {
  columns: DataViewColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  className?: string;
}) => {
  const primary = columns.find((c) => c.role === "primary");
  const trailing = columns.find((c) => c.role === "trailing");
  const meta = columns.filter((c) => c.role !== "primary" && c.role !== "trailing");

  // 手機：左邊主要識別 ＋ 右邊狀態；桌面：每欄各自的寬度。
  const trackVars = {
    "--dv-cols-compact": "minmax(0,1fr) auto",
    "--dv-cols-expanded": columns.map((c) => c.width).join(" "),
  } as React.CSSProperties;

  const grid =
    "grid grid-cols-[var(--dv-cols-compact)] lg:grid-cols-[var(--dv-cols-expanded)] gap-x-3 gap-y-2 lg:gap-3";

  return (
    <div className={cn("rounded-2xl border border-neutral-200 bg-white overflow-hidden", className)}>
      {/* 表頭只有桌面有；手機的小標在每一格裡面 */}
      <div
        style={trackVars}
        className={cn(
          grid,
          "hidden lg:grid px-4.5 py-2.5 bg-neutral-50 border-b border-neutral-100 text-xs font-semibold text-neutral-500"
        )}
      >
        {columns.map((c) => (
          <div key={c.key}>{c.header}</div>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={rowKey(row)}
          style={trackVars}
          className={cn(
            grid,
            "items-center px-3.5 py-3 lg:px-4.5 lg:py-3.5 border-b border-neutral-100 last:border-b-0 transition-colors",
            onRowClick && "cursor-pointer hover:bg-neutral-50"
          )}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {primary && <div className="min-w-0">{primary.render(row)}</div>}

          {/* 手機：一條會換行的 meta 行。桌面：contents 溶掉這層包裝，
              下面每一格直接掉進自己的欄位。 */}
          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
            {meta.map((c) => (
              <Cell key={c.key} column={c} row={row} />
            ))}
          </div>

          {/* 手機：用 grid 座標釘在第一列右邊，DOM 順序（與 tab 順序）不變。 */}
          {trailing && (
            <div className="col-start-2 row-start-1 lg:col-auto lg:row-auto flex items-center justify-end lg:justify-between gap-2 min-w-0">
              {trailing.render(row)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataView;
