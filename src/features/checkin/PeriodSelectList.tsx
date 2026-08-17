"use client";

import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { TodayLesson, timeFmt } from "./types";

// Today's lessons grouped by lesson with their periods as toggleable rows.
// Shared by the LIFF check-in page and the public QR check-in page so both
// entrances present 簽到 the same way. Purely presentational.
const PeriodSelectList = ({
  lessons,
  selected,
  onToggle,
}: {
  lessons: TodayLesson[];
  selected: Set<number>;
  onToggle: (periodId: number) => void;
}) => {
  return (
    <div className="flex flex-col gap-4">
      {lessons.map((lesson) => (
        <div key={lesson.lessonId} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{lesson.lessonName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${DANCE_TYPE_META[lesson.danceType].badge}`}
            >
              {danceTypeLabel(lesson.danceType)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {lesson.periods.map((period) => {
              const isSelected = selected.has(period.periodId);
              const disabled = period.alreadyChecked;
              return (
                <button
                  key={period.periodId}
                  disabled={disabled}
                  onClick={() => onToggle(period.periodId)}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                    disabled
                      ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                      : isSelected
                        ? "border-primary-500 bg-primary-50"
                        : "border-neutral-200 active:bg-neutral-50"
                  }`}
                >
                  <span>
                    {timeFmt.format(new Date(period.startTime))} –{" "}
                    {timeFmt.format(new Date(period.endTime))}
                  </span>
                  <span className="text-sm">
                    {disabled ? (
                      "已簽到"
                    ) : isSelected ? (
                      <span className="font-medium text-primary-600">已選</span>
                    ) : (
                      "點選報到"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PeriodSelectList;
