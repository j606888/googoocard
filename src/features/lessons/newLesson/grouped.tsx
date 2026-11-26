"use client";

import { createContext, useContext } from "react";
import { Check, ChevronRight } from "lucide-react";
import InfoTip from "@/components/InfoTip";
import { cn } from "@/lib/utils";

/**
 * 新增課程用的「分組清單」元件（Apple 設定頁的做法，2026-11-11 使用者挑的風格）：
 * 淡灰綠底（鼠尾草，配咕咕卡的綠）上的白色圓角群組、細分隔線；
 * 選項用整列打勾（`CheckRow`）、少數互斥選項用分段控制（`SegmentedControl`）。
 * 手機：群組上方小標、下方註解。電腦（lg）：設定頁兩欄，左邊粗體標題＋註解、右邊群組。
 */

/**
 * 外觀：`card`（預設）＝上面說的白色圓角群組；`plain`＝去框線——沒有底色、沒有白卡，
 * 小標＋細線分隔的列，註解收進 ⓘ。課程頁「設定」分頁用 `<GroupedLook value="plain">` 包起來，
 * 裡面的 `GroupedSection`／列元件就會自己換外觀；新增課程精靈、課卡／老師表單不包，維持原樣。
 */
export type GroupedLookValue = "card" | "plain";
const GroupedLookContext = createContext<GroupedLookValue>("card");
export const GroupedLook = GroupedLookContext.Provider;
export const useGroupedLook = () => useContext(GroupedLookContext);
/** 列的左右留白：白卡裡要內縮，去框線時貼齊標題。 */
export const useRowPad = () => (useContext(GroupedLookContext) === "plain" ? "px-0" : "px-4");

/** 去框線時可以點的整列：hover 底色往外多 12px，字還是貼齊標題。 */
const PLAIN_HIT = "-mx-3 w-[calc(100%+1.5rem)] rounded-lg px-3 hover:bg-primary-50 active:bg-primary-50";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300";

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
  /** 註解：手機在群組下方，電腦在左欄標題下面；去框線時收進標題旁的 ⓘ。 */
  footer?: React.ReactNode;
  /** 標題旁邊的小連結，例如預覽的「修改」。 */
  action?: React.ReactNode;
  error?: string;
  /** 不包白色群組（例如直接放一條分段控制）。 */
  bare?: boolean;
  children: React.ReactNode;
}) => {
  const look = useGroupedLook();
  if (look === "plain") {
    return (
      <section className="flex flex-col">
        {(title || action) && (
          <div className="flex min-h-9 items-center gap-1">
            {title && <h4 className="text-[13px] font-semibold text-ink-2">{title}</h4>}
            {footer && <InfoTip label={`${title ?? ""}說明`}>{footer}</InfoTip>}
            <span className="flex-1" />
            {action}
          </div>
        )}
        {bare ? children : <div className="divide-y divide-line border-b border-line">{children}</div>}
        {error && (
          <p role="alert" className="pt-1.5 text-[13px] font-medium text-danger-700">
            {error}
          </p>
        )}
      </section>
    );
  }
  return (
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
};

/** 標題旁的文字小按鈕（「更改」「完成」「＋加老師」）。 */
export const SectionAction = ({
  children,
  onClick,
  expanded,
}: {
  children: React.ReactNode;
  onClick: () => void;
  expanded?: boolean;
}) => (
  <button
    type="button"
    aria-expanded={expanded}
    onClick={onClick}
    className={cn(
      "-mr-2 flex min-h-11 shrink-0 cursor-pointer items-center rounded-lg px-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 lg:min-h-9",
      FOCUS_RING
    )}
  >
    {children}
  </button>
);

/**
 * 先看再改的一列：左邊名稱、右邊目前的值（純文字），按「更改」才在這一列下面展開選項。
 * 單選的清單選完就由呼叫端收起來；複選的按「完成」收。
 */
export const DisclosureRow = ({
  label,
  value,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  value: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const pad = useRowPad();
  return (
    <div>
      <div className={cn("flex min-h-12 items-center gap-3", pad)}>
        <span className="shrink-0 text-[15px] text-ink">{label}</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate text-right text-[15px] text-ink-2">
          {value}
        </span>
        <SectionAction expanded={open} onClick={() => onOpenChange(!open)}>
          <span className="sr-only">{label}：</span>
          {open ? "完成" : "更改"}
        </SectionAction>
      </div>
      {open && <div className={cn("divide-y divide-line border-t border-line pb-1", pad === "px-0" && "pl-4")}>{children}</div>}
    </div>
  );
};

/** 一列：左邊名稱、右邊內容。 */
export const GroupedRow = ({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => {
  const plain = useGroupedLook() === "plain";
  return (
    <div className={cn("flex min-h-12 items-center gap-3 py-2", plain ? "px-0" : "px-4", className)}>
      <span className={cn("shrink-0 text-[15px]", plain ? "text-ink" : "text-neutral-900")}>{label}</span>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center justify-end gap-2 text-[15px]",
          plain ? "text-ink-2" : "text-neutral-500"
        )}
      >
        {children}
      </div>
    </div>
  );
};

/** 可以點的一列（往下一層、或打開某個東西），右邊一個 ›。 */
export const ActionRow = ({
  children,
  onClick,
  tone = "accent",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "accent" | "plain";
}) => {
  const plain = useGroupedLook() === "plain";
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-2 text-left text-[15px]",
        plain ? cn(PLAIN_HIT, FOCUS_RING) : "w-full px-4 hover:bg-neutral-50 active:bg-neutral-100",
        tone === "accent"
          ? plain
            ? "font-semibold text-primary-800"
            : "font-medium text-primary-700"
          : plain
            ? "text-ink"
            : "text-neutral-900"
      )}
    >
      <span className="flex-1">{children}</span>
      {tone === "plain" && <ChevronRight className={cn("size-4", plain ? "text-ink-3" : "text-neutral-400")} />}
    </button>
  );
  return plain ? <div>{button}</div> : button;
};

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
}) => {
  const plain = useGroupedLook() === "plain";
  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 py-2 text-left",
        plain ? cn(PLAIN_HIT, FOCUS_RING) : "w-full px-4 hover:bg-neutral-50 active:bg-neutral-100"
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-[15px]", plain ? "text-ink" : "text-neutral-900")}>{children}</span>
        {hint && <span className={cn("text-[13px]", plain ? "text-ink-3" : "text-neutral-500")}>{hint}</span>}
      </span>
      <Check
        aria-hidden="true"
        strokeWidth={2.5}
        className={cn("size-5 shrink-0", plain ? "text-primary-800" : "text-primary-700", !checked && "invisible")}
      />
    </button>
  );
  return plain ? <div>{button}</div> : button;
};

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
}) => {
  const plain = useGroupedLook() === "plain";
  return (
    <label className={cn("flex min-h-12 items-center gap-3", plain ? "px-0" : "px-4")}>
      <span className={cn("shrink-0 text-[15px]", plain ? "text-ink" : "text-neutral-900")}>{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none",
          plain
            ? // 平常就是一行字；滑過、點進去才露出淡底，看得出可以改。
              "-mr-2 h-9 rounded-lg px-2 text-ink placeholder:text-ink-3 hover:bg-band focus:bg-band"
            : "text-neutral-900 placeholder:text-neutral-400"
        )}
      />
    </label>
  );
};
