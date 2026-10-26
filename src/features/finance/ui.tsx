import type { ComponentProps, ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** 卡片（docs/design-system.md：框線、不加陰影）。 */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-neutral-200 bg-white", className)} {...props} />;
}

/** 卡片裡的區塊標題（標題三）。 */
export function PanelTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-bold text-neutral-900", className)} {...props} />;
}

/**
 * 還沒做的功能：按鈕停用，旁邊標「之後」——不留按了沒反應的按鈕
 * （docs/modules-plan.md §3.6）。
 */
export function LaterAction({
  children,
  variant = "secondary",
  size = "md",
  className,
}: {
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Button type="button" variant={variant} size={size} disabled>
        {children}
      </Button>
      <span className="text-xs font-medium text-neutral-500">之後</span>
    </span>
  );
}

/** 一組選項裡的一張卡（資金模式、繳回方式）：標題＋一行說明，選中時深綠框。 */
export function OptionCard({
  selected,
  title,
  hint,
  disabled,
  onSelect,
}: {
  selected: boolean;
  title: ReactNode;
  hint: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-[72px] flex-col gap-0.5 rounded-xl border bg-white px-4 py-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed",
        selected
          ? "border-primary-700 bg-primary-50 ring-1 ring-primary-700"
          : "border-neutral-300 enabled:hover:border-primary-300 disabled:opacity-60"
      )}
    >
      <span className={cn("text-[15px]", selected ? "font-bold text-primary-900" : "font-medium text-neutral-900")}>
        {title}
      </span>
      <span className="text-[13px] text-neutral-600">{hint}</span>
    </button>
  );
}

/** 標籤在上的欄位外框（給 select、日期等自己組的控制項）。 */
export function LabeledControl({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-neutral-500">{hint}</p>}
    </div>
  );
}

/** 沒有 `finance.edit` 的人看得到內容，但會改東西的按鈕不顯示；這行說明為什麼。 */
export function NeedsEditNotice({ action, className }: { action: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[13px] text-neutral-500", className)}>
      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
      要有「{PERMISSIONS["finance.edit"].label}」權限才能{action}。
    </p>
  );
}
