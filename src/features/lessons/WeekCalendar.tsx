"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type AgendaPeriod,
  useGetLessonWeekQuery,
} from "@/store/slices/lessons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addDaysToDateKey,
  taipeiWeekStartKey,
  toTaipeiDateKey,
} from "@/lib/taipei-date";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

type BlockState = "taken" | "overdue" | "inClass" | "upcoming";

const blockState = (period: AgendaPeriod, now: Date): BlockState => {
  const start = new Date(period.startTime).getTime();
  const end = new Date(period.endTime).getTime();
  const t = now.getTime();
  if (start <= t && t < end) return "inClass";
  if (period.attendanceTakenAt) return "taken";
  if (start <= t) return "overdue";
  return "upcoming";
};

const BLOCK_STYLE: Record<BlockState, string> = {
  taken: "bg-band text-ink-2 hover:bg-[#E9EFEC]",
  overdue: "bg-warning-50 text-ink hover:bg-warning-100",
  inClass: "bg-primary-100 text-ink hover:brightness-95",
  upcoming: "bg-primary-50 text-ink hover:bg-primary-100",
};

const statusText = (period: AgendaPeriod, state: BlockState) =>
  state === "taken"
    ? `${period.attendeeIds.length} 人`
    : state === "overdue"
      ? "還沒點名"
      : state === "inClass"
        ? "上課中"
        : null;

/** 今天的課（上課中、還沒點名、等一下要上）直接進點名；其他天進課程頁。 */
const hrefFor = (period: AgendaPeriod, state: BlockState, todayKey: string) =>
  state === "overdue" ||
  (state !== "taken" &&
    toTaipeiDateKey(new Date(period.startTime)) === todayKey)
    ? `/lessons/${period.lesson.id}/periods/${period.id}/check`
    : `/lessons/${period.lesson.id}`;

/**
 * 課程列表的「週曆」：一週（日～六）有哪些課。電腦是七欄，手機是上面一排日子、下面那天的課。
 * 範圍篩選（我的課／分部）由外面傳 `filter` 進來，跟列表模式同一套。
 */
const WeekCalendar = ({
  now,
  isExpanded,
  showLocation,
  filter,
}: {
  now: Date;
  isExpanded: boolean;
  /** 教室有好幾個分部時，每堂寫分部名。 */
  showLocation: boolean;
  filter: (period: AgendaPeriod) => boolean;
}) => {
  const todayKey = toTaipeiDateKey(now);
  const thisWeek = taipeiWeekStartKey(now);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const { data, isFetching } = useGetLessonWeekQuery(weekStart, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const days = useMemo(() => {
    const keys = Array.from({ length: 7 }, (_, i) =>
      addDaysToDateKey(weekStart, i),
    );
    const byDay = new Map(keys.map((k) => [k, [] as AgendaPeriod[]]));
    for (const period of (data?.periods ?? []).filter(filter)) {
      byDay.get(toTaipeiDateKey(new Date(period.startTime)))?.push(period);
    }
    return keys.map((key, i) => ({
      key,
      weekday: WEEKDAYS[i],
      date: Number(key.slice(8)),
      periods: byDay.get(key) ?? [],
    }));
  }, [data, weekStart, filter]);

  const range = `${Number(weekStart.slice(5, 7))}/${Number(weekStart.slice(8))} – ${Number(
    days[6].key.slice(5, 7),
  )}/${days[6].date}`;
  const goWeek = (key: string) => {
    setWeekStart(key);
    setPickedDay(null);
  };

  const toolbar = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="上一週"
        onClick={() => goWeek(addDaysToDateKey(weekStart, -7))}
        className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-primary-50"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="min-w-32 text-center text-[15px] font-semibold tabular-nums text-ink">
        {range}
      </span>
      <button
        type="button"
        aria-label="下一週"
        onClick={() => goWeek(addDaysToDateKey(weekStart, 7))}
        className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-primary-50"
      >
        <ChevronRight className="size-5" />
      </button>
      {weekStart !== thisWeek && (
        <button
          type="button"
          onClick={() => goWeek(thisWeek)}
          className="ml-1 h-8 cursor-pointer rounded-md border border-neutral-300 px-3 text-[13px] text-ink-2 hover:bg-primary-50"
        >
          本週
        </button>
      )}
    </div>
  );

  if (isExpanded) {
    return (
      <section aria-label="週曆" className="flex flex-col gap-3">
        {toolbar}
        <div className="grid grid-cols-7 border-t border-l border-neutral-200">
          {days.map((day) => {
            const isToday = day.key === todayKey;
            return (
              <div
                key={day.key}
                className={cn(
                  "flex min-h-72 flex-col border-r border-b border-neutral-200",
                  isToday && "bg-primary-50/40",
                )}
              >
                <div
                  className={cn(
                    "flex items-baseline gap-1.5 border-b border-line px-2.5 pt-2.5 pb-2 text-[13px]",
                    isToday ? "font-semibold text-primary-900" : "text-ink-3",
                  )}
                >
                  {day.weekday}
                  {isToday ? (
                    <span className="grid size-7 place-items-center rounded-full bg-primary-800 text-sm font-semibold text-white">
                      {day.date}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-ink">
                      {day.date}
                    </span>
                  )}
                  {isToday && <span>今天</span>}
                </div>
                <div className="flex flex-col gap-1.5 p-1.5">
                  {!data && isFetching ? (
                    <Skeleton className="h-14 w-full rounded-md" />
                  ) : (
                    day.periods.map((period) => {
                      const state = blockState(period, now);
                      const status = statusText(period, state);
                      return (
                        <Link
                          key={period.id}
                          href={hrefFor(period, state, todayKey)}
                          className={cn(
                            "block rounded-md px-2.5 py-2 text-[13px] leading-snug",
                            BLOCK_STYLE[state],
                          )}
                        >
                          <span className="block text-xs tabular-nums text-ink-3">
                            {format(new Date(period.startTime), "HH:mm")}
                            {showLocation &&
                              period.lesson.location &&
                              ` · ${period.lesson.location.name}`}
                          </span>
                          <span className="block font-semibold text-ink">
                            {period.lesson.name}
                          </span>
                          {status && (
                            <span
                              className={cn(
                                "block text-xs",
                                state === "overdue"
                                  ? "font-semibold text-warning-800"
                                  : state === "inClass"
                                    ? "font-semibold text-primary-900"
                                    : "text-ink-3",
                              )}
                            >
                              {status}
                            </span>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-3">
          灰底已上過 · 黃底還沒點名 · 綠底還沒上 · 今天的課點了直接進點名
        </p>
      </section>
    );
  }

  // 手機：預設今天（這週）或那週第一個有課的日子。
  const defaultDay =
    days.find((d) => d.key === todayKey)?.key ??
    days.find((d) => d.periods.length > 0)?.key ??
    days[0].key;
  const selected =
    days.find((d) => d.key === (pickedDay ?? defaultDay)) ?? days[0];

  return (
    <section aria-label="週曆" className="flex flex-col gap-3">
      <div className="flex justify-center">{toolbar}</div>
      <div
        role="tablist"
        aria-label="這一週"
        className="grid grid-cols-7 gap-0.5 text-center"
      >
        {days.map((day) => {
          const isToday = day.key === todayKey;
          const on = day.key === selected.key;
          const hasOverdue = day.periods.some(
            (p) => blockState(p, now) === "overdue",
          );
          return (
            <button
              key={day.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`${day.weekday} ${day.date} 日，${day.periods.length} 堂`}
              onClick={() => setPickedDay(day.key)}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs",
                on
                  ? "bg-ink text-white"
                  : isToday
                    ? "font-semibold text-primary-900"
                    : "text-ink-3",
              )}
            >
              {isToday ? "今天" : day.weekday}
              <span
                className={cn(
                  "text-[17px] font-semibold",
                  on ? "text-white" : "text-ink",
                )}
              >
                {day.date}
              </span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {day.periods.slice(0, 4).map((p) => (
                  <span
                    key={p.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      hasOverdue
                        ? "bg-warning-500"
                        : on
                          ? "bg-white"
                          : "bg-ink-3",
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="-mx-5 h-2 bg-band" />
      <div>
        <h2 className="mb-1 text-[15px] font-semibold text-ink">
          {Number(selected.key.slice(5, 7))}/{selected.date}（{selected.weekday}
          ）{selected.key === todayKey && " 今天"}
        </h2>
        {!data && isFetching ? (
          <Skeleton className="h-14 w-full rounded-lg" />
        ) : selected.periods.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">這天沒有課</p>
        ) : (
          <ul>
            {selected.periods.map((period) => {
              const state = blockState(period, now);
              const status = statusText(period, state);
              return (
                <li
                  key={period.id}
                  className="border-b border-line last:border-b-0"
                >
                  <Link
                    href={hrefFor(period, state, todayKey)}
                    className="flex min-h-15 items-center gap-3 py-2"
                  >
                    <span className="w-12 shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                      {format(new Date(period.startTime), "HH:mm")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {period.lesson.name}
                      </span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {[
                          showLocation ? period.lesson.location?.name : null,
                          status,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {state === "overdue" && (
                      <span className="text-[13px] font-semibold text-warning-800">
                        補點名
                      </span>
                    )}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-ink-3"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default WeekCalendar;
