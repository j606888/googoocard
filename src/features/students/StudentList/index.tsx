"use client";

import NewStudent from "./NewStudent";
import { Student, useGetStudentsQuery, useGetTagsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import SingleStudent from "./SingleStudent";
import RosterRow from "./RosterRow";
import Searchbar from "./Searchbar";
import SortMenu from "./SortMenu";
import FilterDrawer from "./FilterDrawer";
import { useState, useMemo, useEffect, useRef } from "react";
import { Users, SlidersHorizontal, X, CornerDownLeft } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, danceTypeLabel } from "@/lib/danceTypes";
import {
  StudentFilters,
  StudentSort,
  EMPTY_FILTERS,
  RECENT_ATTEND_DAYS,
  applyStudentFilters,
  countActiveFilters,
  daysSinceLastAttend,
  loadStudentFilters,
  saveStudentFilters,
  loadStudentSort,
  saveStudentSort,
  remainingSessions,
  sortStudents,
  tagLabel,
} from "./studentFilters";

const NEEDS_RENEWAL_TAG = "Needs Renewal";

interface StudentListProps {
  /**
   * "page" —— 手機版整頁列表（原本的樣子）。
   * "roster" —— 桌面分割檢視的左欄：密集列、鍵盤操作、選取狀態由外部持有。
   */
  variant?: "page" | "roster";
  selectedId?: number | null;
  onSelect?: (student: Student) => void;
  /** roster 模式按 Enter 時開啟完整頁面 */
  onOpenFull?: (student: Student) => void;
}

const StudentList = ({
  variant = "page",
  selectedId = null,
  onSelect,
  onOpenFull,
}: StudentListProps) => {
  const isRoster = variant === "roster";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<StudentSort>("name");
  const [hydratedClassroomId, setHydratedClassroomId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: allStudents = [], isLoading } = useGetStudentsQuery({ query });
  const { data: lessonsData } = useGetLessonsQuery({ tab: "inProgress", sort: "createdAt" });
  const { data: tags = [] } = useGetTagsQuery();
  const { data: classroomData } = useGetClassroomsQuery();
  const classroomId = classroomData?.currentClassroomId;

  const inProgressLessons = lessonsData?.lessons ?? [];

  // 學生資格中實際存在的舞種，動態決定「過課」可選項
  const availableQualifications = useMemo(
    () => ALL_DANCE_TYPES.filter((type) => allStudents.some((s) => s.danceQualifications?.includes(type))),
    [allStudents]
  );

  // 載入：教室就緒（或切換）後從 localStorage 還原（mount 先 EMPTY，避免 hydration mismatch）
  useEffect(() => {
    if (classroomId == null) return;
    setFilters(loadStudentFilters(classroomId));
    setSort(loadStudentSort(classroomId));
    setHydratedClassroomId(classroomId);
  }, [classroomId]);

  // 儲存：僅在「已還原當前教室」後才持久化，避免還原/切換當下用舊值覆寫
  useEffect(() => {
    if (classroomId == null || hydratedClassroomId !== classroomId) return;
    saveStudentFilters(classroomId, filters);
  }, [classroomId, hydratedClassroomId, filters]);

  useEffect(() => {
    if (classroomId == null || hydratedClassroomId !== classroomId) return;
    saveStudentSort(classroomId, sort);
  }, [classroomId, hydratedClassroomId, sort]);

  const students = useMemo(
    () => sortStudents(applyStudentFilters(allStudents, filters), sort),
    [allStudents, filters, sort]
  );

  // roster：沒有選取時自動選第一位，右欄才不會開場就空著
  useEffect(() => {
    if (!isRoster || selectedId != null || students.length === 0) return;
    onSelect?.(students[0]);
  }, [isRoster, selectedId, students, onSelect]);

  // roster 鍵盤操作：↑↓ 換人、Enter 開完整頁、/ 聚焦搜尋
  useEffect(() => {
    if (!isRoster) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        !!active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && isTyping) {
        active?.blur();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (students.length === 0) return;
        event.preventDefault();
        const index = students.findIndex((s) => s.id === selectedId);
        const next =
          index < 0
            ? 0
            : event.key === "ArrowDown"
              ? Math.min(index + 1, students.length - 1)
              : Math.max(index - 1, 0);
        onSelect?.(students[next]);
        return;
      }
      if (event.key === "Enter" && selectedId != null) {
        const selected = students.find((s) => s.id === selectedId);
        if (selected) onOpenFull?.(selected);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRoster, students, selectedId, onSelect, onOpenFull]);

  // 鍵盤換人時把選取列捲進視野
  useEffect(() => {
    if (!isRoster) return;
    listRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [isRoster, selectedId]);

  if (isLoading) return <ListSkeleton />;

  const activeCount = countActiveFilters(filters);

  const lessonName = (id: number) => inProgressLessons.find((l) => l.id === id)?.name;

  const toggleTag = (name: string) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));

  const hasNeedsRenewalTag = tags.some((tag) => tag.name === NEEDS_RENEWAL_TAG);

  // 快速條件：桌面版有空間，把最常用的四個從篩選抽屜拉到檯面上（各自獨立可疊加）
  const quickFilters = [
    ...(hasNeedsRenewalTag
      ? [
          {
            key: "renewal",
            label: "需續約",
            alert: true,
            count: allStudents.filter((s) =>
              s.tags?.some((t) => t.name === NEEDS_RENEWAL_TAG)
            ).length,
            active: filters.tags.includes(NEEDS_RENEWAL_TAG),
            toggle: () => toggleTag(NEEDS_RENEWAL_TAG),
          },
        ]
      : []),
    {
      key: "inLesson",
      label: "上課中",
      alert: false,
      count: allStudents.filter((s) => s.isInActiveLesson).length,
      active: filters.inActiveLesson,
      toggle: () => setFilters((f) => ({ ...f, inActiveLesson: !f.inActiveLesson })),
    },
    {
      key: "recent",
      label: "近期上課",
      alert: false,
      count: allStudents.filter((s) => {
        const days = daysSinceLastAttend(s);
        return days !== null && days <= RECENT_ATTEND_DAYS;
      }).length,
      active: filters.recentlyAttended,
      toggle: () => setFilters((f) => ({ ...f, recentlyAttended: !f.recentlyAttended })),
    },
    {
      key: "noCard",
      label: "無課卡",
      alert: false,
      count: allStudents.filter((s) => remainingSessions(s) === 0).length,
      active: filters.noActiveCard,
      toggle: () => setFilters((f) => ({ ...f, noActiveCard: !f.noActiveCard })),
    },
  ];

  // 已選條件 pill（可單獨移除）
  const activePills: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.inActiveLesson
      ? [{ key: "status", label: "上課中", onRemove: () => setFilters((f) => ({ ...f, inActiveLesson: false })) }]
      : []),
    ...(filters.recentlyAttended
      ? [
          {
            key: "recent",
            label: "近期上課",
            onRemove: () => setFilters((f) => ({ ...f, recentlyAttended: false })),
          },
        ]
      : []),
    ...(filters.noActiveCard
      ? [
          {
            key: "noCard",
            label: "無課卡",
            onRemove: () => setFilters((f) => ({ ...f, noActiveCard: false })),
          },
        ]
      : []),
    ...filters.tags.map((name) => ({
      key: `tag:${name}`,
      label: tagLabel(name),
      onRemove: () => setFilters((f) => ({ ...f, tags: f.tags.filter((t) => t !== name) })),
    })),
    ...filters.qualifications.map((type) => ({
      key: `qual:${type}`,
      label: `${danceTypeLabel(type as DanceType)} Lv1`,
      onRemove: () =>
        setFilters((f) => ({ ...f, qualifications: f.qualifications.filter((q) => q !== type) })),
    })),
    ...filters.lessonIds
      .filter((id) => lessonName(id))
      .map((id) => ({
        key: `lesson:${id}`,
        label: lessonName(id) as string,
        onRemove: () => setFilters((f) => ({ ...f, lessonIds: f.lessonIds.filter((l) => l !== id) })),
      })),
  ];

  const filterButton = (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${
        activeCount > 0
          ? "bg-primary-50 border-primary-400 text-primary-700"
          : "bg-white border-neutral-200 text-neutral-700 hover:border-primary-300"
      }`}
    >
      <SlidersHorizontal className="w-4 h-4" />
      篩選
      {activeCount > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary-500 text-white text-xs font-semibold">
          {activeCount}
        </span>
      )}
    </button>
  );

  // 搜尋是後端做的，所以 allStudents 空掉可能是「教室真的沒人」也可能是
  // 「這組關鍵字沒中」——用有沒有下條件來分辨，別對著搜不到的人喊「還沒有學生」。
  const isNarrowed = query.trim().length > 0 || activeCount > 0;

  const emptyState = (
    <div className="flex flex-col items-center justify-center p-8 gap-3 bg-primary-50 rounded-2xl">
      <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
        <Users className="w-6 h-6 text-white" />
      </div>
      <div className="flex flex-col items-center justify-center">
        <p className="text-lg font-bold">
          {isNarrowed ? "找不到符合的學生" : "還沒有學生"}
        </p>
        <p className="text-sm text-neutral-500 text-center">
          {isNarrowed
            ? "換個關鍵字，或清掉上面的篩選條件"
            : "建立學生後就可以開始上課"}
        </p>
      </div>
    </div>
  );

  const drawer = (
    <FilterDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      filters={filters}
      onChange={setFilters}
      tags={tags}
      lessons={inProgressLessons}
      availableQualifications={availableQualifications}
      resultCount={students.length}
    />
  );

  if (isRoster) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-white">
        <div className="px-4 pt-4 pb-2.5 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">
              學生
              <span className="ml-2 text-[13px] font-normal text-neutral-400">
                {students.length} / {allStudents.length}
              </span>
            </h2>
            <NewStudent />
          </div>

          <Searchbar onSearch={setQuery} inputRef={searchInputRef} compact />

          <div className="flex items-center gap-2 mt-2.5">
            <SortMenu sort={sort} onChange={setSort} />
            <div className="ml-auto">{filterButton}</div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {quickFilters.map((quick) => (
              <button
                key={quick.key}
                type="button"
                onClick={quick.toggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors cursor-pointer ${
                  quick.active
                    ? "bg-primary-500 border-primary-500 text-white font-medium"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
                }`}
              >
                {quick.alert && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      quick.active ? "bg-white" : "bg-danger-500"
                    }`}
                  />
                )}
                {quick.label} {quick.count}
              </button>
            ))}
          </div>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-4">{emptyState}</div>
          ) : (
            students.map((student) => (
              <RosterRow
                key={student.id}
                student={student}
                selected={student.id === selectedId}
                onSelect={() => onSelect?.(student)}
              />
            ))
          )}
        </div>

        <div className="flex-none flex gap-4 px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-[11px] text-neutral-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-px border border-neutral-200 rounded bg-white">↑</kbd>
            <kbd className="px-1 py-px border border-neutral-200 rounded bg-white">↓</kbd>
            切換
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-px border border-neutral-200 rounded bg-white">/</kbd>
            搜尋
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            開啟完整頁
          </span>
        </div>

        {drawer}
      </div>
    );
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">學生</h2>
        <NewStudent />
      </div>

      <Searchbar onSearch={setQuery} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SortMenu sort={sort} onChange={setSort} />
        {filterButton}
      </div>

      {/* 已選條件 pills */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={pill.onRemove}
              className="flex items-center gap-1 pl-3 pr-2 py-1 rounded-full text-sm bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors cursor-pointer"
            >
              {pill.label}
              <X className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}

      {students.length === 0 && emptyState}

      <div className="flex flex-col">
        {students.map((student) => (
          <SingleStudent key={student.id} student={student} />
        ))}
      </div>

      {drawer}
    </div>
  );
};

export default StudentList;
