"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import {
  sortRosterRows,
  type RosterRow,
  type RosterSort,
} from "@/domains/attendance/rosterInsights";
import { studentDetailHref } from "@/lib/studentNav";
import StreakStrip, { StreakDates } from "./StreakStrip";
import CardStatusPill from "./CardStatusPill";

/** Past this many periods the dates no longer fit; the per-cell tooltip remains. */
const MAX_DATED_PERIODS = 12;

const SORTS: { key: RosterSort; label: string }[] = [
  { key: "attention", label: "需要注意" },
  { key: "rate", label: "出席率" },
  { key: "name", label: "姓名" },
];

// The matrix, transposed: one line per student instead of a grid you read by
// column. Same information in a fraction of the height, plus the card status
// the matrix never showed.
const RosterList = ({ rows }: { rows: RosterRow[] }) => {
  const [sort, setSort] = useState<RosterSort>("attention");
  const pathname = usePathname();

  if (rows.length === 0) {
    return (
      <section>
        <h3 className="text-sm font-bold text-neutral-700 mb-2.5">名單</h3>
        <p className="text-sm text-neutral-400 py-6 text-center bg-neutral-50 rounded-xl">
          還沒有學生加入這門課
        </p>
      </section>
    );
  }

  const sorted = sortRosterRows(rows, sort);

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-sm font-bold text-neutral-700">
          名單 · {rows.length} 位
        </h3>
        <div className="flex items-center gap-1.5">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              aria-pressed={sort === option.key}
              className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 cursor-pointer transition-colors ${
                sort === option.key
                  ? "bg-primary-100 border-primary-300 text-primary-900"
                  : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-neutral-200 rounded-xl overflow-hidden">
        {/* Date header — only while every date fits over its segment. Mirrors a
            row's layout so the columns line up. */}
        {sorted[0].cells.length <= MAX_DATED_PERIODS && (
          <div className="flex items-center gap-2.5 px-3 pt-2 pb-1 bg-neutral-50 border-b border-neutral-100">
            <span className="w-[30px] shrink-0" />
            <span className="w-16 shrink-0 text-[10px] text-neutral-400">學生</span>
            <div className="flex-1 min-w-0">
              <StreakDates cells={sorted[0].cells} />
            </div>
            <span className="w-11 shrink-0 text-right text-[10px] text-neutral-400">出席</span>
            <span className="w-[72px] shrink-0 text-center text-[10px] text-neutral-400">本課課卡</span>
            <span className="hidden sm:block w-11 shrink-0 text-right text-[10px] text-neutral-400">最後</span>
          </div>
        )}
        {sorted.map((row, index) => (
          <div
            key={row.student.id}
            className={`flex items-center gap-2.5 px-3 py-2 ${
              index === sorted.length - 1 ? "" : "border-b border-neutral-100"
            }`}
          >
            <Image
              src={row.student.avatarUrl}
              alt={row.student.name}
              width={30}
              height={30}
              className="rounded-full shrink-0"
            />
            <Link
              href={studentDetailHref(row.student.id, pathname)}
              className="w-16 shrink-0 text-[12.5px] font-semibold text-neutral-900 truncate hover:text-primary-700"
            >
              {row.student.name}
            </Link>

            <div className="flex-1 min-w-0">
              <StreakStrip cells={row.cells} />
            </div>

            <span
              className={`w-11 shrink-0 text-right text-[11.5px] font-semibold tabular-nums ${
                row.taken > 0 && row.attended / row.taken < 0.8
                  ? "text-danger-600"
                  : "text-neutral-700"
              }`}
            >
              {row.attended}/{row.taken}
            </span>

            <CardStatusPill status={row.student.cardStatus} />

            <span className="hidden sm:block w-11 shrink-0 text-right text-[11px] text-neutral-400">
              {row.lastAttendedStartTime
                ? format(new Date(row.lastAttendedStartTime), "M/d")
                : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-2.5">
        <Legend className="bg-primary-500" label="出席" />
        <Legend className="bg-danger-400" label="缺席" />
        <Legend
          className="bg-white border border-dashed border-neutral-300"
          label="尚未點名"
        />
        <span className="ml-auto hidden sm:block text-[10.5px] text-neutral-400">
          出席 / 已點名堂數 · 最後出席
        </span>
      </div>
    </section>
  );
};

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
    <span className={`w-2.5 h-2.5 rounded-sm ${className}`} />
    {label}
  </span>
);

export default RosterList;
