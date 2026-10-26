"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import RoundCheckbox from "@/components/RoundCheckbox";
import FilterChip from "@/components/FilterChip";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetLessonsQuery, type LessonSummary } from "@/store/slices/lessons";
import { useAssignLocationMutation, type Location } from "@/store/slices/locations";

// 0 = 週日, same as Date#getDay.
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

type Row = { lesson: LessonSummary; weekday: number | null; time: string; teachers: string };

function toRow(lesson: LessonSummary): Row {
  // The lesson's usual slot: its next class, else its first one.
  const iso = lesson.nextSessionDate ?? lesson.firstPeriodStart;
  const at = iso ? new Date(iso) : null;
  return {
    lesson,
    weekday: at ? at.getDay() : null,
    time: at ? `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` : "",
    teachers: lesson.teachers.map((t) => t.name).join("、"),
  };
}

const SKELETON_ROWS = [
  { width: "w-32", fade: "" },
  { width: "w-24", fade: "" },
  { width: "w-28", fade: "opacity-50" },
  { width: "w-20", fade: "opacity-25" },
];

/**
 * 「套用到既有課程」：列出還沒設定分部的課，勾選要標成這個分部的。同一天兩個分部
 * 都有課（例：週二台南、高雄各一班，不同老師）也分得開——「依星期」「依老師」只是
 * 快速勾選，最後以勾到的課為準。
 */
const AssignLocationDrawer = ({ location, onClose }: { location: Location; onClose: () => void }) => {
  const [includeFinished, setIncludeFinished] = useState(false);
  const { data, isFetching } = useGetLessonsQuery({ tab: includeFinished ? "all" : "inProgress", sort: "name" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assign, { isLoading }] = useAssignLocationMutation();

  const rows = useMemo(
    () =>
      (data?.lessons ?? [])
        .filter((l) => !l.location)
        .map(toRow)
        .sort((a, b) => (a.weekday ?? 7) - (b.weekday ?? 7) || a.time.localeCompare(b.time)),
    [data]
  );
  const weekdays = [...new Set(rows.map((r) => r.weekday).filter((d): d is number => d !== null))].sort();
  const teachers = [...new Set(rows.flatMap((r) => r.lesson.teachers.map((t) => t.name)))];

  const idsWhere = (match: (r: Row) => boolean) => rows.filter(match).map((r) => r.lesson.id);
  const allSelected = (ids: number[]) => ids.length > 0 && ids.every((id) => selected.has(id));
  // Tapping a quick chip selects that whole group, or clears it when it's already all selected.
  const toggleGroup = (ids: number[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const on = ids.every((id) => next.has(id));
      ids.forEach((id) => (on ? next.delete(id) : next.add(id)));
      return next;
    });
  const toggle = (id: number) => toggleGroup([id]);

  const handleSubmit = async () => {
    try {
      const { updated } = await assign({ locationId: location.id, lessonIds: [...selected] }).unwrap();
      toast.success(`已把 ${updated} 門課標為「${location.name}」`);
      onClose();
    } catch {
      toast.error("套用失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      open
      title={`套用「${location.name}」到既有課程`}
      subtitle="勾選在這個分部上的課；只列出還沒設定分部的課"
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      disabled={selected.size === 0}
      submitText={selected.size ? `套用到 ${selected.size} 門課` : "套用"}
    >
      <div className="mb-6 flex flex-col gap-4">
        {(weekdays.length > 1 || teachers.length > 1) && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-neutral-500">快速勾選</p>
            {weekdays.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => {
                  const ids = idsWhere((r) => r.weekday === day);
                  return (
                    <FilterChip key={day} size="sm" active={allSelected(ids)} onClick={() => toggleGroup(ids)}>
                      週{WEEKDAYS[day]}
                    </FilterChip>
                  );
                })}
              </div>
            )}
            {teachers.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {teachers.map((name) => {
                  const ids = idsWhere((r) => r.lesson.teachers.some((t) => t.name === name));
                  return (
                    <FilterChip key={name} size="sm" active={allSelected(ids)} onClick={() => toggleGroup(ids)}>
                      {name}
                    </FilterChip>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {rows.length === 0 && !isFetching && (
          <EmptyState
            kind="inline"
            title={includeFinished ? "所有課程都已經設定分部了" : "進行中的課都已經設定分部了"}
          />
        )}

        {rows.length === 0 && isFetching && (
          <ul className="flex flex-col">
            {SKELETON_ROWS.map((row, i) => (
              <li key={i} className={`flex items-center gap-3 px-2 py-2.5 ${row.fade}`}>
                <Skeleton className="h-3.5 w-8 shrink-0" />
                <span className="flex flex-1 flex-col gap-2">
                  <Skeleton className={`h-3.5 ${row.width}`} />
                  <Skeleton className="h-2.5 w-24" />
                </span>
                <Skeleton className="size-6 shrink-0" />
              </li>
            ))}
          </ul>
        )}

        <ul className="flex flex-col">
          {rows.map((row) => {
            const on = selected.has(row.lesson.id);
            return (
              <li key={row.lesson.id}>
                <button
                  type="button"
                  onClick={() => toggle(row.lesson.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left cursor-pointer ${on ? "bg-primary-100" : "hover:bg-neutral-50"}`}
                >
                  <span className="w-10 shrink-0 text-sm font-medium text-neutral-600">
                    {row.weekday !== null ? `週${WEEKDAYS[row.weekday]}` : "—"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-neutral-900">{row.lesson.name}</span>
                    <span className="truncate text-xs text-neutral-500">
                      {[row.time, row.teachers, row.lesson.status === "finished" ? "已結束" : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <RoundCheckbox isChecked={on} className="shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>

        <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeFinished}
            onChange={(e) => setIncludeFinished(e.target.checked)}
            className="h-4 w-4 accent-primary-900"
          />
          也列出已結束的課
        </label>
      </div>
    </Drawer>
  );
};

export default AssignLocationDrawer;
