"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { endOfDay, format, isToday } from "date-fns";
import { Search } from "lucide-react";
import {
  sortRosterRows,
  type RosterRow,
  type RosterSort,
} from "@/domains/attendance/rosterInsights";
import { studentDetailHref } from "@/lib/studentNav";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import SortMenu, { type SortOption } from "@/components/SortMenu";

const SORTS: SortOption<RosterSort>[] = [
  { value: "attention", label: "需要注意優先", short: "需要注意" },
  { value: "rate", label: "出席率低的優先", short: "出席率" },
  { value: "name", label: "依姓名", short: "姓名" },
];

const CELL_STYLES = {
  attended: "bg-primary-500",
  absent: "bg-danger-400",
  not_started: "border-[1.5px] border-dashed border-neutral-300",
} as const;
const CELL_LABELS = { attended: "出席", absent: "缺席", not_started: "還沒點名" } as const;

/** Width of the frozen 學生 column, in px — the 出席 column sticks right after it. */
const NAME_COL = 200;

/**
 * Desktop roster: a spreadsheet with frozen panes. 學生 and 出席 stay put while
 * the dates scroll sideways — newest next to the names, older further right —
 * and the header stays put while the rows scroll. Only today and past periods
 * get a column; future ones have nothing to show yet.
 */
const RosterTable = ({
  rows,
  attentionIds,
}: {
  rows: RosterRow[];
  /** Students listed under 需要注意 — the 需要注意 filter. */
  attentionIds: Set<number>;
}) => {
  const pathname = usePathname();
  const [sort, setSort] = useState<RosterSort>("attention");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortRosterRows(rows, sort).filter(
      (row) =>
        (!onlyAttention || attentionIds.has(row.student.id)) &&
        (!q || row.student.name.toLowerCase().includes(q))
    );
  }, [rows, sort, onlyAttention, attentionIds, query]);

  if (rows.length === 0) {
    return (
      <section>
        <h2 className="mb-2.5 text-[15px] font-bold text-neutral-900">名單</h2>
        <EmptyState kind="inline" title="還沒有學生加入這門課" />
      </section>
    );
  }

  const dueBy = endOfDay(new Date()).getTime();
  // Column order, newest first. Every row has the same periods in the same order.
  const columnIndexes = rows[0].cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => new Date(cell.startTime).getTime() <= dueBy)
    .reverse();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="mr-1 text-[15px] font-bold text-neutral-900">
          名單 <span className="font-medium text-neutral-500">{rows.length} 位</span>
        </h2>
        <FilterChip size="sm" active={!onlyAttention} onClick={() => setOnlyAttention(false)} count={rows.length}>
          全部
        </FilterChip>
        <FilterChip
          size="sm"
          active={onlyAttention}
          onClick={() => setOnlyAttention(true)}
          count={attentionIds.size}
        >
          需要注意
        </FilterChip>
        <span className="flex-1" />
        <label className="flex h-9 w-48 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 focus-within:border-primary-500">
          <Search className="size-4 shrink-0 text-neutral-400" />
          <input
            aria-label="搜尋學生"
            placeholder="搜尋學生"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <SortMenu sort={sort} options={SORTS} onChange={setSort} />
      </div>

      <div className="max-h-[600px] overflow-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-30 border-b border-neutral-200 bg-white px-4 py-3 text-left font-medium text-neutral-500"
                style={{ width: NAME_COL, minWidth: NAME_COL }}
              >
                學生
              </th>
              <th
                className="sticky top-0 z-30 w-16 min-w-16 border-r border-b border-neutral-200 bg-white px-3.5 py-3 text-right font-medium text-neutral-500 shadow-[6px_0_8px_-6px_rgba(16,28,23,0.18)]"
                style={{ left: NAME_COL }}
              >
                出席
              </th>
              {columnIndexes.map(({ cell }) => {
                const today = isToday(new Date(cell.startTime));
                return (
                  <th
                    key={cell.periodId}
                    className={`sticky top-0 z-20 w-[68px] min-w-[68px] border-b border-neutral-200 bg-white px-1 py-3 text-center text-xs font-medium whitespace-nowrap ${
                      today ? "text-warning-900" : "text-neutral-500"
                    }`}
                  >
                    {today ? "今天" : format(new Date(cell.startTime), "M/d")}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.student.id} className="group">
                <td
                  className="sticky left-0 z-10 border-b border-neutral-100 bg-white px-4 py-2 group-hover:bg-neutral-50"
                  style={{ width: NAME_COL, minWidth: NAME_COL, maxWidth: NAME_COL }}
                >
                  <span className="flex items-center gap-2.5">
                    <Image src={row.student.avatarUrl} alt="" width={28} height={28} className="shrink-0 rounded-full" />
                    <Link
                      href={studentDetailHref(row.student.id, pathname)}
                      className="truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
                    >
                      {row.student.name}
                    </Link>
                  </span>
                </td>
                <td
                  className={`sticky z-10 border-r border-b border-neutral-100 border-r-neutral-200 bg-white px-3.5 py-2 text-right font-semibold whitespace-nowrap tabular-nums shadow-[6px_0_8px_-6px_rgba(16,28,23,0.18)] group-hover:bg-neutral-50 ${
                    row.taken > 0 && row.attended / row.taken < 0.8 ? "text-danger-700" : "text-neutral-700"
                  }`}
                  style={{ left: NAME_COL }}
                >
                  {row.attended}/{row.taken}
                </td>
                {columnIndexes.map(({ cell, index }) => {
                  const status = row.cells[index].status;
                  const label = `${format(new Date(cell.startTime), "M/d")} ${CELL_LABELS[status]}`;
                  return (
                    <td
                      key={cell.periodId}
                      className="border-b border-neutral-100 text-center group-hover:bg-neutral-50"
                    >
                      <span
                        role="img"
                        aria-label={label}
                        title={label}
                        className={`inline-block size-3.5 rounded-full align-middle ${CELL_STYLES[status]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-neutral-500">沒有符合的學生</p>
        )}
      </div>

      <div className="flex items-center gap-3.5 text-xs text-neutral-500">
        <Legend className={CELL_STYLES.attended} label="出席" />
        <Legend className={CELL_STYLES.absent} label="缺席" />
        <Legend className={`bg-white ${CELL_STYLES.not_started}`} label="還沒點名" />
        <span className="ml-auto">出席 / 已點名堂數</span>
      </div>
    </section>
  );
};

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className={`size-2.5 rounded-full ${className}`} />
    {label}
  </span>
);

export default RosterTable;
