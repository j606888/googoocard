"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Droplet, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCan } from "@/hooks/useCan";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetDayBookQuery, type LessonSplitRow } from "@/store/slices/finance";
import { Panel } from "../ui";
import { dayLabel, money } from "../format";
import { financeHref } from "../routes";
import LessonTable from "./LessonTable";
import OverrideDialog from "./OverrideDialog";
import { isClean, useTeacherNames, useVerify } from "./hooks";

const DAY_MS = 24 * 60 * 60 * 1000;
const shift = (dateKey: string, days: number) =>
  toTaipeiDateKey(new Date(parseTaipeiDateRange(dateKey).start.getTime() + days * DAY_MS));

/** 一天一頁：這天的收入分給水庫、老師、場地各多少，加上這天真的收付的錢。 */
export default function DayBookPage({ date }: { date: string }) {
  const router = useRouter();
  const { data, isLoading } = useGetDayBookQuery(date);
  const nameOf = useTeacherNames();
  const { run, busy } = useVerify();
  const canEdit = useCan("finance.edit");
  const [editing, setEditing] = useState<LessonSplitRow | null>(null);

  const clean = (data?.lessons ?? []).filter(isClean);
  const parts = (s: { teach: number; venue: number; assistant: number; remainder: number }) =>
    [
      s.teach && "分潤",
      s.venue && "場地費",
      s.assistant && "助教",
      s.remainder && `零頭 ${money(s.remainder)}`,
    ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={financeHref.verify} className="text-sm font-medium text-primary-700">‹ 驗收</Link>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" aria-label="前一天" onClick={() => router.push(financeHref.day(shift(date, -1)))}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-bold tabular-nums text-neutral-900">{dayLabel(parseTaipeiDateRange(date).start)}</h2>
        <Button variant="ghost" size="iconSm" aria-label="後一天" onClick={() => router.push(financeHref.day(shift(date, 1)))}>
          <ChevronRight className="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>收入照點名算，扣掉場地費、助教費、抽成，剩下的給老師。驗收過的照驗收時存下的分法。</p>
            <p className="mt-2">「錢的進出」是這天真的收付的錢。學生付的課卡錢先算預收，上了課才變成收入。</p>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          <section aria-label="這天的收入分給誰" className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-sm text-neutral-700">點名收入</span>
              <span className="text-2xl font-bold text-neutral-900">{money(data.distribution.revenue)}</span>
              <span className="text-sm text-neutral-500">分給</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile icon={<Droplet className="size-4 text-primary-900" />} label="水庫基金" amount={money(data.distribution.fund, { signed: true })} tone="positive" />
              {data.distribution.people.map((p) => (
                <Tile key={p.teacherId} label={nameOf(p.teacherId)} amount={money(p.total)} hint={parts(p)} />
              ))}
              {data.distribution.externalVenue > 0 && <Tile label="外面的場地" amount={money(data.distribution.externalVenue)} hint="場租帳" />}
            </div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel
              title="課程"
              action={
                <Button size="sm" disabled={clean.length === 0 || busy} isLoading={busy} onClick={() => run(clean.map((r) => r.periodId), true)}>
                  驗收沒問題的 {clean.length} 堂
                </Button>
              }
            >
              {data.lessons.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-500">這天沒有課</p>
              ) : (
                <LessonTable rows={data.lessons} nameOf={nameOf} onVerify={(id) => run([id], false)} onEdit={canEdit ? setEditing : undefined} busy={busy} />
              )}
            </Panel>

            <Panel title="錢的進出">
              <ul className="flex flex-col text-sm tabular-nums">
                {data.custody.map((c) => (
                  <li key={`c${c.studentCardId}`} className="flex justify-between gap-3 border-t border-neutral-200 py-3 first:border-t-0">
                    <span className="flex flex-col">
                      <span>{c.label}</span>
                      <span className="text-xs text-neutral-500">{c.holder?.name ?? "？"}收的 → 他的背包</span>
                    </span>
                    <span>+{money(c.amount)}</span>
                  </li>
                ))}
                {data.vault.rows.map((r, i) => (
                  <li key={`v${i}`} className="flex justify-between gap-3 border-t border-neutral-200 py-3 first:border-t-0">
                    <span className="flex flex-col">
                      <span className={r.voided ? "line-through text-neutral-400" : ""}>{r.label}</span>
                      <span className="text-xs text-neutral-500">大水庫{r.by ? ` · ${r.by} 記的` : ""}</span>
                    </span>
                    <span className={r.amount < 0 ? "text-warning-950" : ""}>{money(r.amount, { signed: true })}</span>
                  </li>
                ))}
                {data.custody.length === 0 && data.vault.rows.length === 0 && (
                  <li className="py-3 text-neutral-500">這天沒有收付</li>
                )}
              </ul>
              {data.vault.balance !== null && (
                <div className="flex justify-between border-t-2 border-neutral-900 pt-3 text-sm font-semibold tabular-nums">
                  <span>大水庫這天結餘</span>
                  <span>{money(data.vault.balance)}</span>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
      {editing && <OverrideDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Tile({ icon, label, amount, hint, tone }: { icon?: React.ReactNode; label: string; amount: string; hint?: string; tone?: "positive" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <span className="flex items-center gap-1.5 text-[13px] text-neutral-600">{icon}{label}</span>
      <span className={`text-xl font-bold tabular-nums ${tone === "positive" ? "text-primary-900" : "text-neutral-900"}`}>{amount}</span>
      {hint && <span className="truncate text-xs text-neutral-500">{hint}</span>}
    </div>
  );
}
