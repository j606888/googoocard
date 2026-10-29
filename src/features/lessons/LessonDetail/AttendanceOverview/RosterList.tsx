"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import {
  recentCells,
  sortRosterRows,
  type RosterRow,
  type RosterSort,
} from "@/domains/attendance/rosterInsights";
import { studentDetailHref } from "@/lib/studentNav";
import StreakStrip, { StreakDates } from "./StreakStrip";
import CardStatusPill from "./CardStatusPill";
import EmptyState from "@/components/EmptyState";
import SortMenu, { type SortOption } from "@/components/SortMenu";

/** Past this many periods the dates no longer fit; the per-cell tooltip remains. */
const MAX_DATED_PERIODS = 12;
/** Squares a phone row has room for — the most recent ones (see recentCells). */
const COMPACT_CELLS = 4;

const SORTS: SortOption<RosterSort>[] = [
  { value: "attention", label: "需要注意優先", short: "需要注意" },
  { value: "rate", label: "出席率低的優先", short: "出席率" },
  { value: "name", label: "依姓名", short: "姓名" },
];

const CELL_STYLES = {
  attended: "bg-primary-500",
  absent: "bg-danger-400",
  not_started: "border border-dashed border-neutral-300",
} as const;
const CELL_LABELS = { attended: "出席", absent: "缺席", not_started: "還沒點名" } as const;

// The matrix, transposed: one line per student instead of a grid you read by
// column. Same information in a fraction of the height, plus the card status
// the matrix never showed. `compact` (phones) drops the date header and the
// ratio column and shows only the latest few squares, dated in the legend.
const RosterList = ({
  rows,
  variant = "expanded",
}: {
  rows: RosterRow[];
  variant?: "compact" | "expanded";
}) => {
  const [sort, setSort] = useState<RosterSort>("attention");
  const pathname = usePathname();
  const compact = variant === "compact";

  if (rows.length === 0) {
    return (
      <section>
        <h3 className="text-base font-bold text-neutral-900 mb-2.5">名單</h3>
        <EmptyState kind="inline" title="還沒有學生加入這門課" />
      </section>
    );
  }

  const sorted = sortRosterRows(rows, sort);
  const shownCells = recentCells(sorted[0].cells, COMPACT_CELLS);
  const range =
    shownCells.length > 0
      ? [shownCells[0], shownCells.at(-1)!]
          .map((cell) => format(new Date(cell.startTime), "M/d"))
          .filter((label, index, all) => all.indexOf(label) === index)
          .join(" → ")
      : null;

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-base font-bold text-neutral-900">
          名單 <span className="font-medium text-neutral-500">{rows.length} 位</span>
        </h3>
        <SortMenu sort={sort} options={SORTS} onChange={setSort} />
      </div>

      <div className="border border-neutral-200 rounded-2xl overflow-hidden">
        {compact ? (
          <div className="flex h-9 items-center gap-2.5 bg-neutral-50 px-3.5 text-[13px] text-neutral-500">
            <span className="flex-1">學生</span>
            <span className="w-[76px]">出席</span>
            <span className="w-[84px] text-right">本課課卡</span>
          </div>
        ) : (
          // Date header — only while every date fits over its segment. Mirrors a
          // row's layout so the columns line up.
          sorted[0].cells.length <= MAX_DATED_PERIODS && (
            <div className="flex items-center gap-2.5 px-3 pt-2 pb-1 bg-neutral-50 border-b border-neutral-100">
              <span className="w-[30px] shrink-0" />
              <span className="w-20 shrink-0 text-[13px] text-neutral-500">學生</span>
              <div className="flex-1 min-w-0">
                <StreakDates cells={sorted[0].cells} />
              </div>
              <span className="w-11 shrink-0 text-right text-[13px] text-neutral-500">出席</span>
              <span className="w-[72px] shrink-0 text-center text-[13px] text-neutral-500">本課課卡</span>
              <span className="hidden sm:block w-11 shrink-0 text-right text-[13px] text-neutral-500">最後</span>
            </div>
          )
        )}
        {sorted.map((row) =>
          compact ? (
            <div
              key={row.student.id}
              className="flex h-13 items-center gap-2.5 border-t border-neutral-100 px-3.5"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Image
                  src={row.student.avatarUrl}
                  alt=""
                  width={30}
                  height={30}
                  className="rounded-full shrink-0"
                />
                <Link
                  href={studentDetailHref(row.student.id, pathname)}
                  className="truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
                >
                  {row.student.name}
                </Link>
              </span>
              <span className="flex w-[76px] gap-[3px]">
                {recentCells(row.cells, COMPACT_CELLS).map((cell) => {
                  const label = `${format(new Date(cell.startTime), "M/d")} ${CELL_LABELS[cell.status]}`;
                  return (
                    <span
                      key={cell.periodId}
                      role="img"
                      aria-label={label}
                      title={label}
                      className={`size-3.5 rounded-[3px] ${CELL_STYLES[cell.status]}`}
                    />
                  );
                })}
              </span>
              <CardStatusPill status={row.student.cardStatus} variant="compact" />
            </div>
          ) : (
            <div
              key={row.student.id}
              className="flex items-center gap-2.5 px-3 py-2 border-b border-neutral-100 last:border-b-0"
            >
              <Image
                src={row.student.avatarUrl}
                alt=""
                width={30}
                height={30}
                className="rounded-full shrink-0"
              />
              <Link
                href={studentDetailHref(row.student.id, pathname)}
                className="w-20 shrink-0 text-sm font-semibold text-neutral-900 truncate hover:text-primary-700"
              >
                {row.student.name}
              </Link>

              <div className="flex-1 min-w-0">
                <StreakStrip cells={row.cells} />
              </div>

              <span
                className={`w-11 shrink-0 text-right text-[13px] font-semibold tabular-nums ${
                  row.taken > 0 && row.attended / row.taken < 0.8
                    ? "text-danger-700"
                    : "text-neutral-700"
                }`}
              >
                {row.attended}/{row.taken}
              </span>

              <CardStatusPill status={row.student.cardStatus} />

              <span className="hidden sm:block w-11 shrink-0 text-right text-xs text-neutral-500">
                {row.lastAttendedStartTime
                  ? format(new Date(row.lastAttendedStartTime), "M/d")
                  : "—"}
              </span>
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-3.5 mt-2.5 text-xs text-neutral-500">
        <Legend className={CELL_STYLES.attended} label="出席" />
        <Legend className={CELL_STYLES.absent} label="缺席" />
        <Legend className={`bg-white ${CELL_STYLES.not_started}`} label="還沒點名" />
        <span className="ml-auto">
          {compact ? range : <span className="hidden sm:inline">出席 / 已點名堂數 · 最後出席</span>}
        </span>
      </div>
    </section>
  );
};

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className={`size-2.5 rounded-[3px] ${className}`} />
    {label}
  </span>
);

export default RosterList;
