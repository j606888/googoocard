"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { Plus } from "lucide-react";
import KiwiLogo from "@/components/KiwiLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetLessonStudentsQuery, type AgendaPeriod } from "@/store/slices/lessons";
import {
  periodOrdinalLabel,
  relativeDayLabel,
  timeLeftLabel,
  type AgendaHero,
} from "./lessonSchedule";
import LateArrivalsSheet from "./LateArrivalsSheet";

/** 「還沒到」最多列幾個名字，其餘寫「等 N 人」。 */
const MAX_MISSING_NAMES = 6;

const teacherNames = (period: AgendaPeriod) =>
  period.lesson.teachers.map((t) => t.name).join("、");

const joinMeta = (parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

const whiteButton = "flex-1 border-white bg-white text-primary-900 hover:border-primary-50 hover:bg-primary-50";
const glassButton = "bg-white/12 px-4 font-semibold text-white hover:bg-white/20 hover:text-white";

/**
 * 課程列表最上面那張深綠卡：上課中的那一堂，沒有就是下一堂。
 * 上課中而且點過名 → 列出還沒到的人，主要按鈕是「補勾遲到的人」。
 */
const LessonHero = ({
  hero,
  now,
  className,
}: {
  hero: NonNullable<AgendaHero<AgendaPeriod>>;
  now: Date;
  className?: string;
}) => {
  const { kind, period } = hero;
  const [lateOpen, setLateOpen] = useState(false);
  const start = new Date(period.startTime);
  const end = new Date(period.endTime);
  const taken = Boolean(period.attendanceTakenAt);
  const inClass = kind === "inClass";
  const isToday = differenceInCalendarDays(start, now) === 0;
  const checkHref = `/lessons/${period.lesson.id}/periods/${period.id}/check`;
  const lessonHref = `/lessons/${period.lesson.id}`;

  // 名冊只有上課中、已點名時才需要（還沒到、補勾抽屜的「沒卡」）。
  const { data: roster } = useGetLessonStudentsQuery(
    { id: period.lesson.id },
    { skip: !(inClass && taken) }
  );
  const attendees = new Set(period.attendeeIds);
  const missing = inClass && taken ? (roster ?? []).filter((s) => !attendees.has(s.id)) : [];

  const label = inClass
    ? `上課中 · ${timeLeftLabel(end, now)}`
    : `下一堂 · ${relativeDayLabel(start, now)}`;

  const ordinal = periodOrdinalLabel(period.number, period.lesson.totalPeriods, period.lesson.kind);
  const meta = inClass
    ? taken
      ? joinMeta([
          teacherNames(period),
          `${format(new Date(period.attendanceTakenAt!), "HH:mm")} 點名，到了 ${period.attendeeIds.length} / ${period.lesson.studentCount} 人`,
        ])
      : joinMeta([
          teacherNames(period),
          ordinal,
          period.attendeeIds.length > 0
            ? `已自助簽到 ${period.attendeeIds.length} 人`
            : `${period.lesson.studentCount} 位學生`,
        ])
    : joinMeta([teacherNames(period), ordinal, `${period.lesson.studentCount} 位學生`]);

  // 主要按鈕：還沒點名（今天的或正在上的）→ 點名；上課中已點名 → 補勾遲到；其他 → 開課程。
  const needsCheck = !taken && (inClass || isToday);
  const primary = needsCheck ? (
    <Button asChild variant="secondary" className={whiteButton}>
      <Link href={checkHref}>點名</Link>
    </Button>
  ) : inClass ? (
    <Button variant="secondary" className={whiteButton} onClick={() => setLateOpen(true)}>
      <Plus className="size-4.5" strokeWidth={2.4} />
      補勾遲到的人
    </Button>
  ) : (
    <Button asChild variant="secondary" className={whiteButton}>
      <Link href={lessonHref}>開課程</Link>
    </Button>
  );
  const showSecondary = needsCheck || inClass;

  return (
    <section
      aria-label={inClass ? "上課中" : "下一堂"}
      className={cn(
        "relative overflow-hidden rounded-[24px] bg-primary-900 px-5 pt-5 pb-4.5 text-white",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-9 size-[170px] rounded-full bg-primary-700"
      />
      {!inClass && (
        <KiwiLogo className="absolute top-5.5 right-4.5 w-16 -scale-x-100 text-primary-400" />
      )}

      <p className="relative flex items-center gap-2 text-[13px] font-semibold tracking-[1px] text-primary-300">
        {inClass && (
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-primary-400 shadow-[0_0_0_4px_rgba(125,218,183,0.25)]"
          />
        )}
        {label}
      </p>
      <p className="relative mt-1.5 flex items-baseline gap-2">
        <span className="text-[44px] leading-none font-extrabold tabular-nums">
          {format(start, "HH:mm")}
        </span>
        <span className="text-base text-primary-300">– {format(end, "HH:mm")}</span>
      </p>
      <p className="relative mt-3.5 truncate text-[19px] font-bold">{period.lesson.name}</p>
      {meta && <p className="relative mt-1 text-[13px] text-primary-100">{meta}</p>}

      {missing.length > 0 && (
        <div className="relative mt-3.5 rounded-xl bg-white/10 px-3 py-2.5">
          <p className="text-xs text-primary-300">還沒到</p>
          <p className="mt-0.5 text-[15px] font-semibold">
            {missing
              .slice(0, MAX_MISSING_NAMES)
              .map((s) => s.name)
              .join("、")}
            {missing.length > MAX_MISSING_NAMES && ` 等 ${missing.length} 人`}
          </p>
        </div>
      )}

      <div className={cn("relative flex gap-2", inClass ? "mt-3" : "mt-4")}>
        {primary}
        {showSecondary && (
          <Button asChild variant="ghost" className={glassButton}>
            <Link href={lessonHref}>開課程</Link>
          </Button>
        )}
      </div>

      {inClass && taken && (
        <LateArrivalsSheet
          open={lateOpen}
          onClose={() => setLateOpen(false)}
          period={period}
          roster={roster}
        />
      )}
    </section>
  );
};

/** 載入中：同一張深綠卡的形狀。 */
export const LessonHeroSkeleton = ({ className }: { className?: string }) => (
  <div
    aria-busy="true"
    className={cn("flex flex-col gap-3 rounded-[24px] bg-primary-900 px-5 pt-5 pb-4.5", className)}
  >
    <Skeleton className="h-3.5 w-28 bg-primary-700" />
    <Skeleton className="h-11 w-32 bg-primary-700" />
    <Skeleton className="h-5 w-44 bg-primary-700" />
    <Skeleton className="mt-1 h-11 w-full rounded-xl bg-primary-700" />
  </div>
);

export default LessonHero;
