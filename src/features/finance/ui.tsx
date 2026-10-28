import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "@/components/Field";
import { money } from "./format";

/** 卡片外框：框線、不加陰影（docs/design-system.md）。 */
export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-neutral-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** 一個數字＋標籤。 */
export function Figure({ label, value, hint, tone = "default", big = false }: { label: ReactNode; value: number; hint?: ReactNode; tone?: "default" | "warning" | "danger" | "positive"; big?: boolean }) {
  const color = { default: "text-neutral-900", warning: "text-warning-950", danger: "text-danger-700", positive: "text-primary-900" }[tone];
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-medium text-neutral-500">{label}</span>
      <span className={cn("font-bold tabular-nums", big ? "text-3xl" : "text-xl", color)}>{money(value)}</span>
      {hint && <span className="text-[13px] text-neutral-500">{hint}</span>}
    </div>
  );
}

/** $ 開頭的金額輸入框（整數）。 */
export function MoneyInput({ id, value, onChange, error, autoFocus, placeholder = "0", ariaDescribedBy }: { id?: string; value: string; onChange: (v: string) => void; error?: boolean; autoFocus?: boolean; placeholder?: string; ariaDescribedBy?: string }) {
  return (
    <div className={cn(fieldControlClass(error), "flex h-12 items-center gap-1.5")}>
      <span className="text-neutral-500" aria-hidden="true">$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ""))}
        className="min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none"
      />
    </div>
  );
}

/** 日期輸入框（原生 date，跟輸入框同一個外觀）。 */
export function DateInput({ id, value, onChange, max }: { id?: string; value: string; onChange: (v: string) => void; max?: string }) {
  return <input id={id} type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} className={cn(fieldControlClass(), "h-12")} />;
}
