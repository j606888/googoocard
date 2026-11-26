"use client";

import Link from "next/link";
import { lessonDropInOptions } from "@/lib/dropInOptions";
import { format, isToday } from "date-fns";
import { ArrowLeft, Check } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { lessonLevelLabel } from "@/lib/danceLevels";
import { Button } from "@/components/ui/button";
import InfoTip from "@/components/InfoTip";
import { weeklyScheduleLabel } from "../lessonSchedule";

/**
 * 這門課的基本資料（舞種、型態、老師、分部、時間、單堂價）：平常用不到，收在課名旁的 ⓘ，
 * 在哪個分頁都點得到；要改去「設定」分頁。電腦、手機頁首共用。
 */
export const LessonInfoTip = ({ lesson }: { lesson: Lesson }) => {
  const levelLabel = lessonLevelLabel(lesson.danceStyle, lesson.level);
  const facts: [string, string | null][] = [
    ["舞種", [danceStyleMeta(lesson.danceStyle).label, levelLabel].filter(Boolean).join(" ")],
    ["型態", lesson.kind === "ongoing" ? "持續開課" : "固定期數"],
    ["老師", lesson.teachers.map((t) => t.name).join("、") || null],
    ["小幫手", lesson.assistants.map((a) => a.name).join("、") || null],
    ["分部", lesson.location?.name ?? null],
    ["時間", weeklyScheduleLabel(lesson.periods ?? [])],
    ["每次扣", lesson.sessionsPerAttendance > 1 ? `${lesson.sessionsPerAttendance} 格` : null],
    [
      "單堂",
      lesson.dropInPrice !== null
        ? lessonDropInOptions(lesson)
            .map((o) => `$${o.price.toLocaleString()}`)
            .join("／")
        : null,
    ],
  ];
  return (
    <InfoTip label="課程資訊" className="text-ink-3 hover:bg-primary-50 hover:text-ink">
      <dl className="flex flex-col gap-1.5 text-[13px] font-normal tracking-normal">
        {facts.map(
          ([label, value]) =>
            value && (
              <div key={label} className="flex gap-3">
                <dt className="w-12 shrink-0 text-ink-3">{label}</dt>
                <dd className="min-w-0 flex-1 tabular-nums text-ink">{value}</dd>
              </div>
            )
        )}
      </dl>
    </InfoTip>
  );
};

/** 狀態寫成字，不用膠囊：進行中＝綠粗體，已結束＝灰。 */
export const LessonStatusText = ({ finished }: { finished: boolean }) => (
  <span
    className={`shrink-0 text-[13px] leading-none tracking-normal ${
      finished ? "font-normal text-ink-3" : "font-semibold text-primary-800"
    }`}
  >
    {finished ? "已結束" : "進行中"}
  </span>
);

/**
 * Desktop lesson header — 只留每個分頁都用得到的：麵包屑、課名＋狀態，右邊「點名 · 今天」
 * （唯一實心的按鈕，今天有課才出現）。分頁列緊接在下面。舞種／老師／時間／單堂價收進課名旁的 ⓘ
 * 和「設定」分頁；第幾期、已上幾堂、收入在「時段」分頁的標題下。編輯＝「設定」分頁，頁首不再放一顆。
 */
const LessonDetailHeader = ({ lesson }: { lesson: Lesson }) => {
  const isFinished = lesson.status === "finished";
  const periods = lesson.periods ?? [];
  const todayPeriod = isFinished
    ? undefined
    : periods.find((p) => !p.attendanceTakenAt && isToday(new Date(p.startTime)));

  return (
    <header className="flex flex-col gap-2">
      <nav aria-label="麵包屑" className="flex items-center gap-2 text-[13px] text-ink-3">
        <Link href="/lessons" className="flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-4" />
          課程
        </Link>
        {lesson.group && lesson.group.name !== lesson.name && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/lessons/groups/${lesson.group.id}`} className="hover:text-ink">
              {lesson.group.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="max-w-xs truncate text-ink-2">{lesson.name}</span>
      </nav>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {lesson.name}
          </h1>
          <LessonInfoTip lesson={lesson} />
          <LessonStatusText finished={isFinished} />
        </div>
        {todayPeriod && (
          <Button asChild>
            <Link href={`/lessons/${lesson.id}/periods/${todayPeriod.id}/check`}>
              <Check className="size-4" />
              點名 · 今天 {format(new Date(todayPeriod.startTime), "HH:mm")}
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
};

export default LessonDetailHeader;
