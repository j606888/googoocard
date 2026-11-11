import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 新增課程用的「分組清單」元件（Apple 設定頁的做法，2026-11-11 使用者挑的風格）：
 * 淡灰綠底（鼠尾草，配咕咕卡的綠）上的白色圓角群組、細分隔線；
 * 選項用整列打勾（`CheckRow`）、少數互斥選項用分段控制（`SegmentedControl`）。
 * 手機：群組上方小標、下方註解。電腦（lg）：設定頁兩欄，左邊粗體標題＋註解、右邊群組。
 */

export const GROUPED_PAGE_BG = "bg-[#f3f6f4]";
/** 分段控制的軌道、關著的開關。 */
export const TRACK_BG = "bg-[#e3ebe6]";
/** 白色群組本身（`GroupedSection` 以外要自己畫一塊時用）。 */
export const GROUP_CARD = "overflow-hidden rounded-xl bg-white divide-y divide-[#e4ebe7]";

export const GroupedSection = ({
  title,
  footer,
  action,
  error,
  bare,
  children,
}: {
  title?: string;
  /** 註解：手機在群組下方，電腦在左欄標題下面。 */
  footer?: React.ReactNode;
  /** 標題旁邊的小連結，例如預覽的「修改」。 */
  action?: React.ReactNode;
  error?: string;
  /** 不包白色群組（例如直接放一條分段控制）。 */
  bare?: boolean;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-1.5 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start lg:gap-x-8">
    <div className="flex flex-col gap-1 lg:pt-3">
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-4 lg:flex-col lg:items-start lg:px-0">
          {title && (
            <h3 className="text-[13px] font-normal text-neutral-500 lg:text-[15px] lg:font-semibold lg:text-neutral-900">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {footer && <p className="hidden text-[13px] leading-relaxed text-neutral-500 lg:block">{footer}</p>}
    </div>
    <div className="flex min-w-0 flex-col gap-1.5">
      {bare ? (
        children
      ) : (
        <div className={cn(GROUP_CARD, error && "ring-1 ring-danger-500")}>{children}</div>
      )}
      {error ? (
        <p className="px-4 text-[13px] text-danger-700">{error}</p>
      ) : (
        footer && <p className="px-4 text-[13px] leading-relaxed text-neutral-500 lg:hidden">{footer}</p>
      )}
    </div>
  </section>
);

/** 一列：左邊名稱、右邊內容。 */
export const GroupedRow = ({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex min-h-12 items-center gap-3 px-4 py-2", className)}>
    <span className="shrink-0 text-[15px] text-neutral-900">{label}</span>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-[15px] text-neutral-500">
      {children}
    </div>
  </div>
);

/** 可以點的一列（往下一層、或打開某個東西），右邊一個 ›。 */
export const ActionRow = ({
  children,
  onClick,
  tone = "accent",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "accent" | "plain";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex min-h-12 w-full cursor-pointer items-center gap-2 px-4 text-left text-[15px] hover:bg-neutral-50 active:bg-neutral-100",
      tone === "accent" ? "font-medium text-primary-700" : "text-neutral-900"
    )}
  >
    <span className="flex-1">{children}</span>
    {tone === "plain" && <ChevronRight className="size-4 text-neutral-400" />}
  </button>
);

/** 打勾的一列：單選、複選都用它，選到的右邊一個 ✓。 */
export const CheckRow = ({
  checked,
  onToggle,
  leading,
  hint,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  leading?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onToggle}
    className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50 active:bg-neutral-100"
  >
    {leading}
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-[15px] text-neutral-900">{children}</span>
      {hint && <span className="text-[13px] text-neutral-500">{hint}</span>}
    </span>
    <Check
      aria-hidden="true"
      strokeWidth={2.5}
      className={cn("size-5 shrink-0 text-primary-700", !checked && "invisible")}
    />
  </button>
);

/** 分段控制：灰色軌道上一顆白色滑塊。選項少（2–4 個）、互斥時用。 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; leading?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex rounded-[9px] p-0.5", TRACK_BG, className)}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-3 text-sm transition-[background-color,box-shadow]",
              on
                ? "bg-white font-semibold text-neutral-900 shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]"
                : "text-neutral-700 hover:text-neutral-900"
            )}
          >
            {option.leading}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 群組裡的輸入框：沒有框線，靠右對齊，像設定頁的文字欄。 */
export const InlineInput = ({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) => (
  <label className="flex min-h-12 items-center gap-3 px-4">
    <span className="shrink-0 text-[15px] text-neutral-900">{label}</span>
    <input
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 bg-transparent text-right text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
    />
  </label>
);
