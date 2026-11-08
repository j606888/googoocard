"use client";

// 財務 v2 畫面共用：金額格式、外框（子導覽＋記一筆）、卡片。設計稿：https://claude.ai/artifact/HS4rYcg7kpaAw1tLqsSqN3
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Plus } from "lucide-react";
import Navbar from "@/features/Navbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import RecordDrawer from "./RecordDrawer";

/** 分 → 「1,234」或「1,234.56」（decimals）。負數用真正的減號。 */
export function amountText(cents: number, opts: { decimals?: boolean; dollar?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(cents) / 100;
  const body = opts.decimals
    ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString("en-US");
  if (!opts.decimals && Math.round(abs) === 0) return opts.dollar ? "$0" : "0";
  return `${neg ? "−" : ""}${opts.dollar ? "$" : ""}${body}`;
}

/** 金額（分）；負數紅字。`blankZero`：0 顯示「—」。 */
export function Amount({
  cents,
  decimals,
  dollar,
  blankZero,
  className,
}: {
  cents: number;
  decimals?: boolean;
  dollar?: boolean;
  blankZero?: boolean;
  className?: string;
}) {
  if (blankZero && cents === 0) return <span className={cn("text-neutral-400", className)}>—</span>;
  return <span className={cn("tabular-nums", cents < 0 && "text-danger-700", className)}>{amountText(cents, { decimals, dollar })}</span>;
}

/** 元（字串，可含兩位小數）→ 分；不合法回 null。 */
export function parseYuan(s: string): number | null {
  const t = s.replace(/[,\s$]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function FinanceCard({ className, children, ...rest }: React.HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-neutral-200 bg-white", className)} {...rest}>
      {children}
    </section>
  );
}

const TABS = [
  { href: "/finance", label: "總覽", exact: true },
  { href: "/finance/reports", label: "報表" },
  { href: "/finance/payouts", label: "結算與付款" },
  { href: "/finance/accounts", label: "資金帳戶" },
  { href: "/finance/close", label: "結帳" },
  { href: "/finance/settings", label: "設定" },
];

/** 財務頁外框：子導覽＋「記一筆」。`title` 在子導覽下面。 */
export function FinanceShell({
  title,
  crumb,
  actions,
  guide,
  noRecord = false,
  children,
}: {
  title?: ReactNode;
  /** 不顯示「記一筆」（開帳精靈：專心做設定）。 */
  noRecord?: boolean;
  /** 使用教學的段落 id（/finance/guide#…）：標題旁出現一顆「看教學」。 */
  guide?: string;
  crumb?: { href: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [recording, setRecording] = useState(false);
  return (
    <>
      <Navbar />
      <div className="flex flex-col gap-5 p-4 lg:px-8 lg:py-6">
        <div className="flex items-end justify-between gap-3 border-b border-neutral-200">
          <nav aria-label="財務" className="-mb-px flex gap-5 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 border-b-2 py-2.5 text-sm transition-colors",
                    active ? "border-primary-700 font-bold text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          {!noRecord && (
            <Button size="sm" className="mb-1.5 hidden lg:inline-flex" onClick={() => setRecording(true)}>
              <Plus />記一筆
            </Button>
          )}
        </div>
        {(title || actions) && (
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              {crumb && (
                <Link href={crumb.href} className="text-[13px] text-neutral-500 hover:text-neutral-800">
                  {crumb.label} /
                </Link>
              )}
              {title && (
                <h1 className="flex items-center gap-1 text-2xl font-bold text-neutral-900">
                  {title}
                  {guide && <GuideLink anchor={guide} />}
                </h1>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
        )}
        {children}
        <div className="h-16 lg:hidden" />
      </div>
      {!noRecord && (
        <>
          <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-10 px-4 pb-3 lg:hidden">
            <Button size="lg" className="w-full shadow-lg" onClick={() => setRecording(true)}>
              <Plus />記一筆
            </Button>
          </div>
          <RecordDrawer open={recording} onClose={() => setRecording(false)} />
        </>
      )}
    </>
  );
}

/** 標題旁的「看教學」：直接跳到教學的那一段。 */
export function GuideLink({ anchor }: { anchor: string }) {
  return (
    <Link
      href={`/finance/guide#${anchor}`}
      aria-label="看教學"
      title="看教學"
      className="inline-grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
    >
      <CircleHelp className="size-4" aria-hidden />
    </Link>
  );
}

/** 分部切換（全教室＋各分部）。 */
export function BranchSwitch({
  locations,
  value,
  onChange,
}: {
  locations: { id: number; name: string }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  if (locations.length < 2) return null;
  const opts = [{ value: "all", label: "全教室" }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))];
  return (
    <div role="group" aria-label="分部" className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
      {opts.map((o) => {
        const active = (value === null ? "all" : String(value)) === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value === "all" ? null : Number(o.value))}
            className={cn(
              "cursor-pointer rounded-lg px-3.5 py-1.5 text-sm transition-colors",
              active ? "bg-white font-semibold text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 依分部取值：null＝全教室。 */
export const pick = (x: { byLocation: Record<number, number>; total: number }, loc: number | null) =>
  loc === null ? x.total : (x.byLocation[loc] ?? 0);

/** 我是不是這間教室的擁有者（解鎖、開帳用）。 */
export function useIsOwner(): boolean {
  const { data } = useGetClassroomsQuery();
  return data?.classrooms.find((c) => c.id === data.currentClassroomId)?.role === "owner";
}
