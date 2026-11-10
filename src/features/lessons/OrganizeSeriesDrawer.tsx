"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import { fieldControlClass } from "@/components/Field";
import type { LessonSummary } from "@/store/slices/lessons";
import { useOrganizeLessonGroupsMutation } from "@/store/slices/lessonGroups";
import { cn } from "@/lib/utils";
import { suggestSeries } from "./seriesSuggest";

const rangeOf = (lesson: LessonSummary) =>
  lesson.firstPeriodStart && lesson.lastPeriodEnd
    ? `${format(new Date(lesson.firstPeriodStart), "yyyy/MM/dd")} – ${format(new Date(lesson.lastPeriodEnd), "MM/dd")}`
    : "還沒排時段";

interface Choice {
  checked: boolean;
  name: string;
}

/**
 * 整理課種：把課名相近的課列成一組一組的建議，老師勾選、改名後一次套用。
 * 兩期以上的預設勾起來；只有一期的要自己勾（它多半就是一門獨立的課）。
 */
const OrganizeSeriesDrawer = ({
  open,
  onClose,
  lessons,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  lessons: LessonSummary[];
  groups: { id: number; name: string }[];
}) => {
  const suggestions = useMemo(() => suggestSeries(lessons, groups), [lessons, groups]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [organize, { isLoading }] = useOrganizeLessonGroupsMutation();

  // 每次打開都從建議重新開始，不留上次沒送出的修改。
  useEffect(() => {
    if (open) setChoices({});
  }, [open]);

  const choiceFor = (key: string): Choice => {
    const suggestion = suggestions.find((s) => s.key === key)!;
    return choices[key] ?? { checked: suggestion.lessons.length > 1, name: suggestion.name };
  };
  const patch = (key: string, change: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [key]: { ...choiceFor(key), ...change } }));

  const picked = suggestions
    .map((s) => ({ suggestion: s, choice: choiceFor(s.key) }))
    .filter(({ choice }) => choice.checked && choice.name.trim());

  const handleSubmit = async () => {
    // 兩組填了同一個名稱 = 併成同一個課種。
    const byName = new Map<string, number[]>();
    for (const { suggestion, choice } of picked) {
      const name = choice.name.trim();
      byName.set(name, [...(byName.get(name) ?? []), ...suggestion.lessons.map((l) => l.id)]);
    }
    try {
      await organize({
        series: [...byName].map(([name, lessonIds]) => ({ name, lessonIds })),
      }).unwrap();
      toast.success(`已整理 ${byName.size} 個課種`);
      onClose();
    } catch {
      toast.error("整理失敗，請再試一次");
    }
  };

  return (
    <Drawer
      title="整理課種"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      disabled={picked.length === 0}
      submitText={picked.length > 0 ? `套用 ${picked.length} 組` : "套用"}
    >
      {suggestions.length === 0 ? (
        <EmptyState kind="inline" title="都整理好了" />
      ) : (
        <ul className="flex flex-col gap-3 pb-2">
          {suggestions.map((suggestion) => {
            const choice = choiceFor(suggestion.key);
            const inputId = `series-name-${suggestion.key}`;
            return (
              <li key={suggestion.key} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`把這 ${suggestion.lessons.length} 門課歸到「${choice.name}」`}
                    checked={choice.checked}
                    onChange={(e) => patch(suggestion.key, { checked: e.target.checked })}
                    className="size-5 shrink-0 accent-primary-700"
                  />
                  <label htmlFor={inputId} className="sr-only">
                    課種名稱
                  </label>
                  <input
                    id={inputId}
                    value={choice.name}
                    onChange={(e) => patch(suggestion.key, { name: e.target.value })}
                    disabled={!choice.checked}
                    className={cn(fieldControlClass(), "h-11 min-w-0 flex-1 font-semibold")}
                  />
                  <span className="shrink-0 text-[13px] text-neutral-600 tabular-nums">
                    {suggestion.lessons.length} 期
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 pl-8 text-[13px] text-neutral-700">
                  {suggestion.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex justify-between gap-3">
                      <span className="truncate">{lesson.name}</span>
                      <span className="shrink-0 tabular-nums text-neutral-600">{rangeOf(lesson)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
};

export default OrganizeSeriesDrawer;
