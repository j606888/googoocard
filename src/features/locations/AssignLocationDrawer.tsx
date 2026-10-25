"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import RoundCheckbox from "@/components/RoundCheckbox";
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

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs font-medium cursor-pointer ${
    on ? "border-primary-700 bg-primary-700 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
  }`;

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
            <p className="text-xs text-neutral-500">快速勾選</p>
            {weekdays.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => {
                  const ids = idsWhere((r) => r.weekday === day);
                  return (
                    <button key={day} type="button" aria-pressed={allSelected(ids)} onClick={() => toggleGroup(ids)} className={chip(allSelected(ids))}>
                      週{WEEKDAYS[day]}
                    </button>
                  );
                })}
              </div>
            )}
            {teachers.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {teachers.map((name) => {
                  const ids = idsWhere((r) => r.lesson.teachers.some((t) => t.name === name));
                  return (
                    <button key={name} type="button" aria-pressed={allSelected(ids)} onClick={() => toggleGroup(ids)} className={chip(allSelected(ids))}>
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {rows.length === 0 && !isFetching && (
          <p className="rounded-xl bg-neutral-50 p-4 text-center text-sm text-neutral-500">
            {includeFinished ? "所有課程都已經設定分部了" : "進行中的課都已經設定分部了"}
          </p>
        )}

        <ul className="flex flex-col">
          {rows.map((row) => {
            const on = selected.has(row.lesson.id);
            return (
              <li key={row.lesson.id}>
                <button
                  type="button"
                  onClick={() => toggle(row.lesson.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left cursor-pointer ${on ? "bg-primary-50" : "hover:bg-neutral-50"}`}
                >
                  <span className="w-10 shrink-0 text-sm font-medium text-neutral-600">
                    {row.weekday !== null ? `週${WEEKDAYS[row.weekday]}` : "—"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{row.lesson.name}</span>
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
            className="h-4 w-4 accent-primary-700"
          />
          也列出已結束的課
        </label>
      </div>
    </Drawer>
  );
};

export default AssignLocationDrawer;
