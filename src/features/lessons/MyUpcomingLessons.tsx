"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetMyLessonsQuery, type MyPeriod } from "@/store/slices/me";

const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const weekdayFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** 「今天」「明天」 or 「10/28 週三」. */
function dayLabel(iso: string, now: Date) {
  const key = toTaipeiDateKey(new Date(iso));
  if (key === toTaipeiDateKey(now)) return "今天";
  if (key === toTaipeiDateKey(new Date(now.getTime() + DAY_MS))) return "明天";
  return dateFmt.format(new Date(iso));
}

const timeRange = (p: MyPeriod) =>
  `${timeFmt.format(new Date(p.startTime))}–${timeFmt.format(new Date(p.endTime))}`;

/** Location and the other teachers: 「台南 · 和阿傑」. */
function metaLine(p: MyPeriod, myTeacherId: number) {
  const others = p.lesson.teachers.filter((t) => t.id !== myTeacherId).map((t) => t.name);
  return [p.lesson.location?.name, others.length > 0 && `和${others.join("、")}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 我接下來的課 — the top of the lessons page for a member linked to a teacher
 * (`Teacher.userId`). Renders nothing for everyone else, including while
 * loading, so a 小幫手's page doesn't flash an empty block.
 */
export default function MyUpcomingLessons() {
  const { data } = useGetMyLessonsQuery(undefined, { refetchOnMountOrArgChange: true });
  if (!data?.teacher) return null;

  const now = new Date();
  const [next, ...rest] = data.periods;
  const teacherId = data.teacher.id;

  return (
    <section aria-labelledby="my-lessons-heading" className="mb-6 flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h3 id="my-lessons-heading" className="text-lg font-bold text-neutral-900">
          我接下來的課
        </h3>
        <span className="text-[13px] text-neutral-500">
          {data.teacher.name}・7 天內 {data.periods.length} 堂
        </span>
      </div>

      {!next ? (
        <EmptyState
          kind="inline"
          icon={<CalendarDays />}
          title="這 7 天沒有你的課"
          description="開課時選了你，課就會出現在這裡"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <NextPeriodCard period={next} teacherId={teacherId} now={now} />
          {rest.length > 0 && (
            <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
              {rest.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/lessons/${p.lesson.id}`}
                    className="flex min-h-15 items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
                  >
                    <span className="flex w-10 shrink-0 flex-col items-center">
                      <span className="text-xs text-neutral-500">{weekdayFmt.format(new Date(p.startTime))}</span>
                      <span className="text-lg font-bold text-neutral-900">{Number(toTaipeiDateKey(new Date(p.startTime)).slice(8))}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-8 w-1 shrink-0 rounded-full ${danceStyleMeta(p.lesson.danceStyle).bg}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium text-neutral-900">{p.lesson.name}</span>
                      <span className="truncate text-[13px] text-neutral-500">
                        {[timeFmt.format(new Date(p.startTime)), metaLine(p, teacherId)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function NextPeriodCard({ period, teacherId, now }: { period: MyPeriod; teacherId: number; now: Date }) {
  const isToday = toTaipeiDateKey(new Date(period.startTime)) === toTaipeiDateKey(now);
  const canCheck = isToday && !period.attendanceTakenAt;
  const meta = metaLine(period, teacherId);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-primary-900 p-5 text-white">
      <span className="text-[13px] font-semibold text-primary-300">
        下一堂 · {dayLabel(period.startTime, now)} {timeRange(period)}
      </span>
      <div className="flex flex-col gap-1">
        <Link href={`/lessons/${period.lesson.id}`} className="text-xl font-bold hover:underline">
          {period.lesson.name}
        </Link>
        {meta && <span className="text-sm text-primary-100">{meta}</span>}
      </div>
      {period.attendanceCount > 0 && (
        <span className="text-sm text-primary-100">
          {period.attendanceTakenAt ? "已點名" : "已自助簽到"} {period.attendanceCount} 人
        </span>
      )}
      {canCheck && (
        <Button asChild variant="secondary" className="self-start border-white bg-white text-primary-900 hover:bg-primary-50">
          <Link href={`/lessons/${period.lesson.id}/periods/${period.id}/check`}>去點名</Link>
        </Button>
      )}
    </div>
  );
}
