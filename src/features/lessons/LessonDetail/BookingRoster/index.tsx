"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { type BookingRoster as Roster, type BookingStatus, Lesson, useGetLessonBookingsQuery } from "@/store/slices/lessons";
import { Button } from "@/components/ui/button";
import InfoTip from "@/components/InfoTip";
import StatusTag from "@/components/StatusTag";
import { cn } from "@/lib/utils";
import BookingDrawer from "./BookingDrawer";

type Entry = Roster["students"][number];

/** 一格的顏色與文字。`null` = 那堂沒預約也沒來。 */
const STATUS_META: Record<Exclude<BookingStatus, null>, { label: string; className: string }> = {
  booked: { label: "預計會來", className: "border border-primary-600 bg-white" },
  present: { label: "有來", className: "bg-primary-600" },
  no_show: { label: "預約沒來", className: "bg-danger-500" },
  walk_in: { label: "沒預約但來了", className: "bg-primary-300" },
};

/**
 * 課程頁「預計會來」：老師事先登記誰哪幾堂會來（單堂、課卡、還沒付都可以）。
 * 每人一排格子看得出預約了沒來；整期學生不在這裡（報了整期就算每堂會到）。
 */
const BookingRoster = ({ lesson }: { lesson: Lesson }) => {
  const { data } = useGetLessonBookingsQuery({ id: lesson.id });
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  if (!data) return null;

  const { students, periods } = data;
  const hasOpen = periods.some((p) => !p.attendanceTaken);
  // 上完的課、又沒人預約過：整區不出現（介面越乾淨越好）。
  if (!hasOpen && students.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 border-b border-line pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-1 text-[17px] font-semibold text-ink lg:text-base">
            預計會來
            <InfoTip label="預計會來說明">先登記誰會來（先上一堂、用課卡、還沒付都可以），點名時標「預計今天會到」、排在最上面；不會自動勾、也不收錢。</InfoTip>
          </h3>
        </div>
        {hasOpen && (
          <Button type="button" variant="text" size="sm" onClick={() => setRegistering(true)}>
            <Plus className="size-4" />
            登記
          </Button>
        )}
      </div>

      {students.length === 0 ? (
        <p className="text-[13px] text-ink-3">還沒有人登記</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {students.map((entry) => (
              <li key={entry.student.id} className="-mx-2 border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-neutral-50"
                >
                  <img src={entry.student.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-semibold">{entry.student.name}</span>
                      {entry.note && <span className="truncate text-xs text-neutral-500">{entry.note}</span>}
                    </span>
                    <span
                      className="flex max-w-48 gap-1"
                      role="img"
                      aria-label={entry.statuses
                        .map((s, i) => `第 ${i + 1} 堂${s ? STATUS_META[s].label : "沒預約"}`)
                        .join("、")}
                    >
                      {entry.statuses.map((status, i) => (
                        <span
                          key={periods[i].id}
                          title={`第 ${i + 1} 堂：${status ? STATUS_META[status].label : "沒預約"}`}
                          className={cn(
                            "h-1.5 min-w-2 flex-1 rounded-full",
                            status ? STATUS_META[status].className : "bg-neutral-100"
                          )}
                        />
                      ))}
                    </span>
                  </span>
                  {entry.counts.noShow > 0 ? (
                    <StatusTag tone="danger">預約沒來 {entry.counts.noShow}</StatusTag>
                  ) : entry.counts.booked > 0 ? (
                    <StatusTag tone="outline">預計 {entry.counts.booked} 堂</StatusTag>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((status) => (
              <span key={status} className="flex items-center gap-1">
                <span className={cn("inline-block h-1.5 w-3 rounded-full", STATUS_META[status].className)} />
                {STATUS_META[status].label}
              </span>
            ))}
          </p>
        </>
      )}

      {registering && (
        <BookingDrawer
          lessonId={lesson.id}
          periods={periods}
          excludeIds={students.map((s) => s.student.id)}
          onClose={() => setRegistering(false)}
        />
      )}
      {editing && (
        <BookingDrawer
          lessonId={lesson.id}
          periods={periods}
          entry={editing}
          excludeIds={[]}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
};

export default BookingRoster;
