"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { LessonSummary } from "@/store/slices/lessons";
import { needsNextPeriod } from "./lessonGrouping";
import { stashLessonClone } from "./lessonClone";
import NextPeriodDrawer from "./NextPeriodDrawer";
import {
  termProgress,
  termSummary,
  UNCLASSIFIED_KEY,
  type LessonSeries,
  type SeriesTerm,
} from "./lessonSeries";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 桌面的欄位：展開鈕｜課種｜舞種·分部｜這一期｜學生｜下一堂｜動作。手機只留名稱＋一行摘要。 */
const COLS =
  "lg:grid lg:grid-cols-[28px_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_56px_minmax(0,1.3fr)_92px] lg:gap-3";

const day = (iso: string, now: Date) => {
  const date = new Date(iso);
  return format(date, date.getFullYear() === now.getFullYear() ? "MM/dd" : "yyyy/MM/dd");
};

const nextLabel = (lesson: LessonSummary, now: Date) => {
  if (lesson.nextSessionDate) {
    const next = new Date(lesson.nextSessionDate);
    return `${format(next, "MM/dd")}（${WEEKDAYS[next.getDay()]}）${format(next, "HH:mm")}`;
  }
  if (lesson.status === "finished") {
    return lesson.lastPeriodEnd ? `${day(lesson.lastPeriodEnd, now)} 結束` : "已結束";
  }
  return "還沒排";
};

const rangeLabel = (lesson: LessonSummary, now: Date) =>
  lesson.firstPeriodStart && lesson.lastPeriodEnd
    ? `${day(lesson.firstPeriodStart, now)} – ${day(lesson.lastPeriodEnd, now)}`
    : "還沒排時段";

const peopleLabel = (lesson: LessonSummary) => {
  const teachers = lesson.teachers.map((t) => t.name).join("、");
  const assistants = (lesson.assistants ?? []).map((t) => t.name).join("、");
  return [teachers, assistants && `小幫手 ${assistants}`].filter(Boolean).join(" · ");
};

const styleLabel = (lesson: LessonSummary) =>
  [danceStyleMeta(lesson.danceStyle).label, lesson.location?.name].filter(Boolean).join(" · ");

const TermRow = ({ term, series, now }: { term: SeriesTerm; series: LessonSeries; now: Date }) => {
  const { lesson, number } = term;
  const running = lesson.status === "inProgress";
  const title = number !== null ? `第 ${number} 期` : lesson.name;
  return (
    <li>
      <Link
        href={`/lessons/${lesson.id}`}
        className={`flex min-h-12 items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-100 ${COLS}`}
      >
        <span aria-hidden="true" className="hidden lg:block" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-neutral-900">{title}</span>
          {number !== null && lesson.name !== series.name && (
            <span className="ml-2 text-neutral-600">{lesson.name}</span>
          )}
          <span className="block truncate text-xs text-neutral-600 lg:hidden">
            {rangeLabel(lesson, now)} · {termProgress(lesson)}
          </span>
        </span>
        <span className="hidden truncate tabular-nums lg:block">{rangeLabel(lesson, now)}</span>
        <span className="hidden truncate lg:block">{termProgress(lesson)}</span>
        <span className="hidden tabular-nums lg:block">{lesson.studentCount}</span>
        <span className={`shrink-0 font-medium ${running ? "text-primary-700" : "text-neutral-600"}`}>
          {running ? "進行中" : "已結束"}
        </span>
        <span aria-hidden="true" className="hidden lg:block" />
      </Link>
    </li>
  );
};

const SeriesRow = ({
  series,
  now,
  onSchedule,
}: {
  series: LessonSeries;
  now: Date;
  onSchedule: (lesson: LessonSummary) => void;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const lead = series.lead?.lesson ?? null;
  // 沒歸課種的單一門課沒有「各期」可展開，整列直接進那門課。
  const isSingle = series.groupId === null && series.key !== UNCLASSIFIED_KEY;
  const students = series.active.reduce((sum, term) => sum + term.lesson.studentCount, 0);
  const panelId = `series-${series.key}`;

  const openNewTerm = () => {
    const source = series.terms[0]?.lesson;
    if (source) {
      stashLessonClone(source);
      router.push("/lessons/new");
    } else {
      router.push(`/lessons/new?groupId=${series.groupId}`);
    }
  };

  const cells = (
    <>
      <ChevronRight
        aria-hidden="true"
        className={`size-4 shrink-0 text-neutral-500 transition-transform ${
          isSingle ? "invisible" : open ? "rotate-90" : ""
        }`}
      />
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ${lead ? danceStyleMeta(lead.danceStyle).bg : "bg-neutral-300"}`}
        />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-neutral-900">
            {series.name}
            {lead && series.active.length > 0 && (
              <span className="ml-2 hidden text-[13px] font-normal text-neutral-600 lg:inline">
                {peopleLabel(lead)}
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-neutral-600 lg:hidden">
            {[termSummary(series), lead && series.active.length > 0 && nextLabel(lead, now)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </span>
      <span className="hidden truncate text-[13px] text-neutral-700 lg:block">
        {lead ? styleLabel(lead) : ""}
      </span>
      <span className="hidden truncate text-[13px] text-neutral-700 lg:block">{termSummary(series)}</span>
      <span className="hidden text-sm tabular-nums lg:block">{series.active.length > 0 ? students : ""}</span>
      <span className="hidden truncate text-[13px] tabular-nums text-neutral-700 lg:block">
        {lead && series.key !== UNCLASSIFIED_KEY ? nextLabel(lead, now) : ""}
      </span>
    </>
  );

  const rowClass = `flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50 ${COLS}`;
  const schedule = lead && series.active.length === 1 && needsNextPeriod(lead);

  return (
    <li className="relative border-t border-neutral-200 first:border-t-0">
      {isSingle && lead ? (
        <Link href={`/lessons/${lead.id}`} className={rowClass}>
          {cells}
          <span aria-hidden="true" className="w-[92px] shrink-0 max-lg:w-9" />
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={rowClass}
        >
          {cells}
          <span aria-hidden="true" className="w-[92px] shrink-0 max-lg:w-9" />
        </button>
      )}

      {/* 動作疊在列尾：放在列的連結／按鈕裡面會變成互動元素包互動元素。 */}
      <div className="absolute top-2.5 right-3 flex h-9 items-center">
        {schedule ? (
          <Button variant="secondary" size="sm" className="gap-1" onClick={() => onSchedule(lead)}>
            <Plus className="size-4" />
            下一堂
          </Button>
        ) : (
          isSingle &&
          lead && (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-neutral-600"
              aria-label={`複製「${lead.name}」開新一期`}
              title="開新一期"
              onClick={openNewTerm}
            >
              <Copy className="size-4" />
            </Button>
          )
        )}
      </div>

      {!isSingle && open && (
        <div id={panelId}>
          <ul>
            {series.terms.map((term) => (
              <TermRow key={term.lesson.id} term={term} series={series} now={now} />
            ))}
          </ul>
          {series.key !== UNCLASSIFIED_KEY && (
            <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-1.5 lg:pl-14">
              <Button variant="ghost" size="sm" className="gap-1 text-primary-700" onClick={openNewTerm}>
                <Plus className="size-4" />
                開新一期
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * 「所有課程」：一列一個課種，展開才看各期。整張表只有一個表頭。
 * 手機與桌面同一棵樹——手機把後面幾欄收成名稱下面的一行摘要。
 */
const SeriesList = ({ series, now }: { series: LessonSeries[]; now: Date }) => {
  const [scheduling, setScheduling] = useState<LessonSummary | null>(null);
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div
        className={`hidden h-10 items-center bg-neutral-50 px-4 text-xs font-medium text-neutral-600 ${COLS}`}
      >
        <span />
        <span>課種</span>
        <span>舞種 · 分部</span>
        <span>這一期</span>
        <span>學生</span>
        <span>下一堂</span>
        <span />
      </div>
      <ul>
        {series.map((item) => (
          <SeriesRow key={item.key} series={item} now={now} onSchedule={setScheduling} />
        ))}
      </ul>
      {scheduling && <NextPeriodDrawer lesson={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  );
};

export default SeriesList;
