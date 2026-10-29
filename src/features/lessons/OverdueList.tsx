"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaPeriod } from "@/store/slices/lessons";
import { agoLabel, periodOrdinalLabel } from "./lessonSchedule";

/** 一次列幾堂；其餘收在「再顯示 N 堂」。 */
const VISIBLE_ROWS = 5;

const metaFor = (period: AgendaPeriod) =>
  [
    period.lesson.teachers.map((t) => t.name).join("、"),
    period.lesson.kind === "fixed"
      ? periodOrdinalLabel(period.number, period.lesson.totalPeriods, "fixed")
      : `${period.lesson.studentCount} 位學生`,
  ]
    .filter(Boolean)
    .join(" · ");

/** 還沒點名：已經開始、還沒點名的時段，一列一堂，舊的在前。沒有就整塊不出現。 */
const OverdueList = ({
  periods,
  now,
  className,
}: {
  periods: AgendaPeriod[];
  now: Date;
  className?: string;
}) => {
  const [showAll, setShowAll] = useState(false);
  if (periods.length === 0) return null;

  const shown = showAll ? periods : periods.slice(0, VISIBLE_ROWS);
  const hidden = periods.length - shown.length;

  return (
    <section aria-labelledby="overdue-heading" className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-warning-600" />
        <h2 id="overdue-heading" className="text-[17px] font-extrabold text-neutral-900">
          還沒點名
        </h2>
        <span className="text-[15px] font-bold text-warning-800">{periods.length}</span>
      </div>
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {shown.map((period) => {
          const start = new Date(period.startTime);
          return (
            <li key={period.id} className="flex h-16 items-center gap-3 pr-3 pl-4">
              <div className="w-11 shrink-0 text-center">
                <p className="text-base font-extrabold text-warning-950 tabular-nums">
                  {format(start, "M/d")}
                </p>
                <p className="text-[11px] text-warning-800">{agoLabel(start, now)}</p>
              </div>
              <Link href={`/lessons/${period.lesson.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-neutral-900">
                  {period.lesson.name}
                </p>
                <p className="truncate text-xs text-neutral-500">{metaFor(period)}</p>
              </Link>
              <Button asChild size="sm">
                <Link href={`/lessons/${period.lesson.id}/periods/${period.id}/check`}>點名</Link>
              </Button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="self-start text-neutral-500" onClick={() => setShowAll(true)}>
          再顯示 {hidden} 堂
        </Button>
      )}
    </section>
  );
};

export default OverdueList;
