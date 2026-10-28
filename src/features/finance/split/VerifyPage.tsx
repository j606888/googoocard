"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCan } from "@/hooks/useCan";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetLessonSplitsQuery, type LessonSplitRow } from "@/store/slices/finance";
import { Panel } from "../ui";
import { dayLabel } from "../format";
import { financeHref } from "../routes";
import LessonTable from "./LessonTable";
import OverrideDialog from "./OverrideDialog";
import { isClean, useTeacherNames, useVerify } from "./hooks";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 這一週（日～六）的頭尾台北日期；offset ＝ 往前幾週。 */
function weekRange(offset: number) {
  const today = parseTaipeiDateRange(toTaipeiDateKey(new Date())).start;
  const weekday = new Date(today.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  const start = new Date(today.getTime() - (weekday + offset * 7) * DAY_MS);
  return { from: toTaipeiDateKey(start), to: toTaipeiDateKey(new Date(start.getTime() + 6 * DAY_MS)) };
}

/**
 * 每堂驗收：點完名的課自動帶進來、算好分帳，這裡做第二次驗收。
 * 誰都可以驗收（看得到水庫就行），會記下是誰。改實拿只給能改水庫的人。
 */
export default function VerifyPage() {
  const [offset, setOffset] = useState(0);
  const range = weekRange(offset);
  const { data: rows, isLoading } = useGetLessonSplitsQuery(range);
  const nameOf = useTeacherNames();
  const { run, busy } = useVerify();
  const canEdit = useCan("finance.edit");
  const [editing, setEditing] = useState<LessonSplitRow | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, LessonSplitRow[]>();
    for (const row of rows ?? []) map.set(row.dateKey, [...(map.get(row.dateKey) ?? []), row]);
    return [...map.entries()];
  }, [rows]);
  const clean = (rows ?? []).filter(isClean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">每堂驗收</h2>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>點完名的課自動帶進來、照分帳規則算好，這裡做第二次驗收。誰都可以驗收，會記下是誰。</p>
            <p className="mt-2">沒問題的可以整批驗收；有提醒的（例如有人沒卡、照暫估）要一堂一堂按。</p>
            <p className="mt-2">驗收後點名又被改，那堂會退回「點名改過」，要再驗收一次。</p>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" aria-label="上一週" onClick={() => setOffset(offset + 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums text-neutral-900">
          {dayLabel(parseTaipeiDateRange(range.from).start)} – {dayLabel(parseTaipeiDateRange(range.to).start)}
        </span>
        <Button variant="ghost" size="iconSm" aria-label="下一週" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
          <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" disabled={clean.length === 0 || busy} isLoading={busy} onClick={() => run(clean.map((r) => r.periodId), true)}>
          驗收沒問題的 {clean.length} 堂
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : days.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-sm text-neutral-500">這週沒有課</p>
        </Panel>
      ) : (
        days.map(([dateKey, dayRows]) => (
          <Panel
            key={dateKey}
            title={dayLabel(parseTaipeiDateRange(dateKey).start)}
            action={<Link href={financeHref.day(dateKey)} className="text-sm font-medium text-primary-700">這天的帳 ›</Link>}
          >
            <LessonTable rows={dayRows} nameOf={nameOf} onVerify={(id) => run([id], false)} onEdit={canEdit ? setEditing : undefined} busy={busy} />
          </Panel>
        ))
      )}
      {editing && <OverrideDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
