"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LessonSummary } from "@/store/slices/lessons";
import { FINISHED_VISIBLE_SECTIONS, groupByEndMonth } from "./lessonGrouping";
import LessonTable from "./LessonTable";

/**
 * 「已結束」分頁：依結束月份分段。同名的課（每期都叫「Bachata Lv1」）
 * 靠月份與期間欄分辨。最近幾段直接展開，更早的收成一列。
 */
const FinishedLessons = ({ lessons }: { lessons: LessonSummary[] }) => {
  const [showEarlier, setShowEarlier] = useState(false);
  const sections = useMemo(() => groupByEndMonth(lessons, new Date()), [lessons]);
  const visible = showEarlier ? sections : sections.slice(0, FINISHED_VISIBLE_SECTIONS);
  const earlier = sections.slice(FINISHED_VISIBLE_SECTIONS);
  const earlierCount = earlier.reduce((sum, s) => sum + s.lessons.length, 0);

  return (
    <div className="flex flex-col gap-5">
      {visible.map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 text-[15px] font-bold text-neutral-900">
            {section.label}
            <span className="text-xs font-normal text-neutral-500">
              {section.lessons.length} 門課
            </span>
          </h3>
          <LessonTable lessons={section.lessons} variant="finished" />
        </section>
      ))}
      {!showEarlier && earlier.length > 0 && (
        <button
          onClick={() => setShowEarlier(true)}
          className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4 -rotate-90 text-neutral-400" />
          <span className="font-semibold">更早</span>
          <span className="text-neutral-500">
            {earlier.at(-1)?.label} – {earlier[0].label} · {earlierCount} 門課
          </span>
          <span className="ml-auto text-primary-700 font-semibold">展開</span>
        </button>
      )}
    </div>
  );
};

export default FinishedLessons;
