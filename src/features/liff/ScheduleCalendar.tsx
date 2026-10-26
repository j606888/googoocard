"use client";

import { ReactNode, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import SegmentedTabs from "@/components/SegmentedTabs";
import { Button } from "@/components/ui/button";
import LiffSkeleton from "@/features/liff/LiffSkeleton";
import ClassroomPicker from "@/features/liff/ClassroomPicker";
import { useLiffClassroomData, type ClassroomChoice } from "@/features/liff/useLiffClassroomData";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { cn } from "@/lib/utils";
import { dateKeyOf, dayLabel, monthGrid, monthLabel, shiftMonth, taipeiTime } from "./scheduleDates";

type SchedulePeriod = {
  id: number;
  lessonId: number;
  startTime: string;
  endTime: string;
  lessonName: string;
  danceStyleId: number;
  levelLabel: string | null;
  teacherNames: string[];
  location: { id: number; name: string } | null;
};

type ScheduleResponse = {
  classroom: ClassroomChoice;
  month: string;
  classrooms: ClassroomChoice[];
  locations: { id: number; name: string }[];
  danceStyles: DanceStyleSummary[];
  myLessonIds: number[];
  periods: SchedulePeriod[];
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * LIFF「課表」：一個月的月曆，有課的日子標舞種色點；可依舞種、分部篩選，點日期列出
 * 當天的課。綁定的學生（`studentId`）多一個「我的課」——他上過或報名的課。
 * `header` 由頁面決定（學生：可切換教室的膠囊；訪客：公開教室）。
 */
export default function ScheduleCalendar({
  idToken,
  studentId,
  header,
}: {
  idToken: string;
  studentId?: number;
  header: (ctx: { classroom: ClassroomChoice | null; classrooms: ClassroomChoice[]; pickClassroom: (id: number) => void }) => ReactNode;
}) {
  const todayKey = dateKeyOf(new Date());
  const [month, setMonth] = useState(() => toTaipeiMonthKey(new Date()));
  const [classroomId, setClassroomId] = useState<number | undefined>();
  const [selected, setSelected] = useState<string>(todayKey);
  const [styleId, setStyleId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [mine, setMine] = useState(false);

  const state = useLiffClassroomData<ScheduleResponse>("/api/liff/schedule", {
    idToken,
    studentId,
    classroomId,
    params: { month },
  });

  const pickClassroom = (id: number) => {
    setClassroomId(id);
    setStyleId(null);
    setLocationId(null);
  };

  const data = state.status === "ready" ? state.data : null;
  const styles = useMemo(() => new Map((data?.danceStyles ?? []).map((s) => [s.id, s])), [data]);

  const byDay = useMemo(() => {
    const map = new Map<string, SchedulePeriod[]>();
    if (!data || data.month !== month) return map;
    const myLessons = new Set(data.myLessonIds);
    for (const p of data.periods) {
      if (styleId !== null && p.danceStyleId !== styleId) continue;
      if (locationId !== null && p.location?.id !== locationId) continue;
      if (mine && !myLessons.has(p.lessonId)) continue;
      const key = dateKeyOf(p.startTime);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [data, month, styleId, locationId, mine]);

  const goMonth = (n: number) => {
    const next = shiftMonth(month, n);
    setMonth(next);
    setSelected(next === todayKey.slice(0, 7) ? todayKey : `${next}-01`);
  };

  const dayPeriods = byDay.get(selected) ?? [];
  const nextDay = [...byDay.keys()].filter((k) => k > selected && k >= todayKey).sort()[0];
  const myLessonIds = new Set(data?.myLessonIds ?? []);

  return (
    <>
      {header({ classroom: data?.classroom ?? null, classrooms: data?.classrooms ?? [], pickClassroom })}

      {state.status === "pick" && <ClassroomPicker classrooms={state.classrooms} onPick={pickClassroom} />}
      {state.status === "none" && <EmptyState kind="inline" title="目前還沒有公開的課表。" />}
      {state.status === "error" && <p className="px-5 py-8 text-center text-sm text-neutral-500">載入失敗，請稍後再試。</p>}
      {state.status === "loading" && <LiffSkeleton />}

      {data && (
        <div className="flex flex-col pb-8">
          {studentId && (
            <div className="bg-white px-4 pt-3">
              <SegmentedTabs
                variant="pill"
                fill
                ariaLabel="課程範圍"
                value={mine ? "mine" : "all"}
                onChange={(v) => setMine(v === "mine")}
                options={[
                  { value: "all", label: "全部課程" },
                  { value: "mine", label: "我的課" },
                ]}
              />
            </div>
          )}

          {(data.danceStyles.length > 1 || data.locations.length > 1) && (
            <div className="flex flex-col gap-2 border-b border-neutral-200 bg-white px-4 py-3">
              {data.danceStyles.length > 1 && (
                <ChipRow label="舞種">
                  <FilterChip size="sm" active={styleId === null} onClick={() => setStyleId(null)}>全部</FilterChip>
                  {data.danceStyles.map((s) => (
                    <FilterChip key={s.id} size="sm" active={styleId === s.id} onClick={() => setStyleId(s.id)}>
                      {s.name}
                    </FilterChip>
                  ))}
                </ChipRow>
              )}
              {data.locations.length > 1 && (
                <ChipRow label="分部">
                  <FilterChip size="sm" active={locationId === null} onClick={() => setLocationId(null)}>全部</FilterChip>
                  {data.locations.map((l) => (
                    <FilterChip key={l.id} size="sm" active={locationId === l.id} onClick={() => setLocationId(l.id)}>
                      {l.name}
                    </FilterChip>
                  ))}
                </ChipRow>
              )}
            </div>
          )}

          <div className="bg-white px-3 pb-3 pt-2">
            <div className="flex h-11 items-center justify-between">
              <Button variant="ghost" size="iconSm" aria-label="上個月" onClick={() => goMonth(-1)}>
                <ChevronLeft />
              </Button>
              <span className="font-semibold text-neutral-900">{monthLabel(month)}</span>
              <Button variant="ghost" size="iconSm" aria-label="下個月" onClick={() => goMonth(1)}>
                <ChevronRight />
              </Button>
            </div>
            <div className="grid grid-cols-7 pb-1.5 pt-1 text-center text-[11px] text-neutral-500">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(month).map((key, i) => {
                if (!key) return <span key={i} className="h-12" />;
                const periods = byDay.get(key) ?? [];
                const dotStyles = [...new Set(periods.map((p) => p.danceStyleId))].slice(0, 3);
                const isSelected = key === selected;
                const isToday = key === todayKey;
                const past = key < todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-label={`${dayLabel(key)}，${periods.length} 堂課`}
                    aria-pressed={isSelected}
                    className="flex h-12 flex-col items-center gap-[3px] cursor-pointer"
                  >
                    <span
                      className={cn(
                        "flex size-[30px] items-center justify-center rounded-full text-sm",
                        isSelected
                          ? "bg-primary-900 font-semibold text-white"
                          : isToday
                            ? "border-2 border-primary-700 font-semibold text-primary-900"
                            : past
                              ? "text-neutral-400"
                              : "text-neutral-900"
                      )}
                    >
                      {Number(key.slice(8))}
                    </span>
                    <span className="flex h-1.5 gap-[3px]">
                      {dotStyles.map((id) => (
                        <span
                          key={id}
                          className={cn("size-1.5 rounded-full", danceStyleMeta(styles.get(id)).dot, past && "opacity-40")}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 px-4 pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-neutral-900">
                {dayLabel(selected)}
                {selected === todayKey && "・今天"}
              </h3>
              {dayPeriods.length > 0 && <span className="text-xs text-neutral-500">{dayPeriods.length} 堂</span>}
            </div>

            {dayPeriods.map((p) => {
              const style = styles.get(p.danceStyleId);
              const meta = danceStyleMeta(style);
              return (
                <div key={p.id} className="flex items-start gap-3.5 rounded-2xl border border-neutral-200 bg-white p-3.5">
                  <div className="flex w-12 shrink-0 flex-col">
                    <span className="font-semibold text-neutral-900">{taipeiTime(p.startTime)}</span>
                    <span className="text-xs text-neutral-500">{taipeiTime(p.endTime)}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                      <span className="font-semibold text-neutral-900">{p.lessonName}</span>
                      {p.levelLabel && (
                        <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                          {p.levelLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500">
                      <span>{meta.label}</span>
                      {p.teacherNames.length > 0 && <span>{p.teacherNames.join("、")} 老師</span>}
                      {p.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="size-3" aria-hidden />
                          {p.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {studentId && myLessonIds.has(p.lessonId) && (
                    <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-900">
                      我的課
                    </span>
                  )}
                </div>
              );
            })}

            {dayPeriods.length === 0 && (
              <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-5">
                <span className="text-sm text-neutral-500">這天沒有課</span>
                {nextDay && (
                  <Button variant="secondary" size="sm" onClick={() => setSelected(nextDay)}>
                    看下一堂：{dayLabel(nextDay)}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      <span className="w-8 shrink-0 text-xs text-neutral-500">{label}</span>
      {children}
    </div>
  );
}
