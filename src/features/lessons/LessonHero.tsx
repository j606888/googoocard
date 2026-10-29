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
/** 已簽到的人最多蓋幾個章，其餘寫「+N」。 */
const MAX_STAMPS = 7;

const teacherNames = (period: AgendaPeriod) =>
  period.lesson.teachers.map((t) => t.name).join("、");

const joinMeta = (parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

const actionButton = "flex-1 bg-primary-800 hover:bg-primary-900";

/** 一個已簽到的人 = 一個奇異鳥章（首頁課卡的同一個圖樣）。 */
const KiwiStamp = () => (
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-800">
    <KiwiLogo className="w-5.5 text-white" />
  </span>
);

/**
 * 課程列表最上面那張白卡：上課中的那一堂，沒有就是下一堂。
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
    <Button asChild className={actionButton}>
      <Link href={checkHref}>點名</Link>
    </Button>
  ) : inClass ? (
    <Button className={actionButton} onClick={() => setLateOpen(true)}>
      <Plus className="size-4.5" strokeWidth={2.4} />
      補勾遲到的人
    </Button>
  ) : (
    <Button asChild className={actionButton}>
      <Link href={lessonHref}>開課程</Link>
    </Button>
  );
  const showSecondary = needsCheck || inClass;

  // 已簽到的人蓋成奇異鳥章；還有人沒到就留一個虛線空位。
  const arrived = period.attendeeIds.length;
  const stamps = Math.min(arrived, MAX_STAMPS);
  const hasOpenSlot = arrived < period.lesson.studentCount;

  return (
    <section
      aria-label={inClass ? "上課中" : "下一堂"}
      className={cn(
        "relative rounded-[24px] border border-primary-100 bg-white px-5 pt-5 pb-4.5 text-neutral-900 shadow-[0_10px_24px_-14px_rgba(18,50,42,0.25)]",
        className
      )}
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-primary-800">
        {inClass && <span aria-hidden="true" className="size-2 rounded-full bg-primary-600" />}
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[40px] leading-none font-extrabold tabular-nums">
          {format(start, "HH:mm")}
        </span>
        <span className="text-base text-neutral-500">– {format(end, "HH:mm")}</span>
      </p>
      <p className="mt-3 truncate text-[19px] font-bold">{period.lesson.name}</p>
      {meta && <p className="mt-1 text-[13px] text-neutral-600">{meta}</p>}

      {arrived > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={`已簽到 ${arrived} 人`}>
          {Array.from({ length: stamps }, (_, i) => (
            <KiwiStamp key={i} />
          ))}
          {arrived > MAX_STAMPS && (
            <span className="text-sm font-bold text-primary-800 tabular-nums">+{arrived - MAX_STAMPS}</span>
          )}
          {hasOpenSlot && (
            <span
              aria-hidden="true"
              className="size-10 shrink-0 rounded-full border-2 border-dashed border-primary-300"
            />
          )}
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-3.5 rounded-xl bg-primary-50 px-3 py-2.5">
          <p className="text-xs text-neutral-500">還沒到</p>
          <p className="mt-0.5 text-[15px] font-semibold">
            {missing
              .slice(0, MAX_MISSING_NAMES)
              .map((s) => s.name)
              .join("、")}
            {missing.length > MAX_MISSING_NAMES && ` 等 ${missing.length} 人`}
          </p>
        </div>
      )}

      <div className={cn("flex gap-2", inClass ? "mt-3.5" : "mt-4")}>
        {primary}
        {showSecondary && (
          <Button asChild variant="secondary" className="px-4">
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

/** 載入中：同一張白卡的形狀。 */
export const LessonHeroSkeleton = ({ className }: { className?: string }) => (
  <div
    aria-busy="true"
    className={cn(
      "flex flex-col gap-3 rounded-[24px] border border-primary-100 bg-white px-5 pt-5 pb-4.5",
      className
    )}
  >
    <Skeleton className="h-3.5 w-28" />
    <Skeleton className="h-10 w-32" />
    <Skeleton className="h-5 w-44" />
    <Skeleton className="mt-1 h-11 w-full rounded-xl" />
  </div>
);

export default LessonHero;
