"use client";

import FilterChip from "@/components/FilterChip";
import NewStudent from "./NewStudent";
import { Student, useGetStudentsQuery, useGetTagsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import SingleStudent from "./SingleStudent";
import RosterRow from "./RosterRow";
import Searchbar from "./Searchbar";
import SortMenu from "@/components/SortMenu";
import FilterDrawer, { StatusFilterOption } from "./FilterDrawer";
import ArchivedStudents from "./ArchivedStudents";
import { useState, useMemo, useEffect, useRef } from "react";
import { Users, SlidersHorizontal, CornerDownLeft } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import {
  StudentFilters,
  StudentSort,
  DEFAULT_SORT,
  SORT_OPTIONS,
  EMPTY_FILTERS,
  LOW_REMAINING_SESSIONS,
  NEEDS_RENEWAL_TAG,
  RECENT_ATTEND_DAYS,
  applyStudentFilters,
  countActiveFilters,
  daysSinceLastAttend,
  isLowRemaining,
  loadStudentFilters,
  saveStudentFilters,
  loadStudentSort,
  saveStudentSort,
  remainingSessions,
  sortStudents,
} from "./studentFilters";

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
  const [sort, setSort] = useState<StudentSort>(DEFAULT_SORT);
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

  // 學生資格中實際存在的舞種，動態決定「過課」可選項（依教室的舞種順序）
  const { byId: danceStylesById } = useDanceStyles();
  const availableQualifications = useMemo(
    () =>
      [...danceStylesById.values()].filter((style) =>
        allStudents.some((s) => s.danceQualifications?.includes(style.id))
      ),
    [allStudents, danceStylesById]
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
    // Also when a search or filter leaves the selected student out — the pane
    // must not keep showing someone the list no longer has.
    if (!isRoster || students.length === 0) return;
    if (selectedId != null && students.some((s) => s.id === selectedId)) return;
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

  const toggleTag = (name: string) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));

  const toggleFlag = (key: "inActiveLesson" | "recentlyAttended" | "noActiveCard" | "lowRemaining" | "unpaid") =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  const hasNeedsRenewalTag = tags.some((tag) => tag.name === NEEDS_RENEWAL_TAG);

  // 狀態條件：前四個是名單上方的快篩 chip，全部都在篩選抽屜的「狀態」區。
  // 數字一律對整份名單算（不受其他條件影響），按下去才知道會剩幾位。
  const quickStatus: StatusFilterOption[] = [
    ...(hasNeedsRenewalTag
      ? [
          {
            key: "renewal",
            label: "需續約",
            alert: true,
            count: allStudents.filter((s) => s.tags?.some((t) => t.name === NEEDS_RENEWAL_TAG))
              .length,
            active: filters.tags.includes(NEEDS_RENEWAL_TAG),
            toggle: () => toggleTag(NEEDS_RENEWAL_TAG),
          },
        ]
      : []),
    {
      key: "low",
      label: `剩 ≤${LOW_REMAINING_SESSIONS} 堂`,
      count: allStudents.filter(isLowRemaining).length,
      active: filters.lowRemaining,
      toggle: () => toggleFlag("lowRemaining"),
    },
    {
      key: "unpaid",
      label: "未付款",
      count: allStudents.filter((s) => s.hasUnpaidCard).length,
      active: filters.unpaid,
      toggle: () => toggleFlag("unpaid"),
    },
    {
      key: "recent",
      label: `近 ${RECENT_ATTEND_DAYS} 天有上課`,
      count: allStudents.filter((s) => {
        const days = daysSinceLastAttend(s);
        return days !== null && days <= RECENT_ATTEND_DAYS;
      }).length,
      active: filters.recentlyAttended,
      toggle: () => toggleFlag("recentlyAttended"),
    },
  ];

  const statusOptions: StatusFilterOption[] = [
    ...quickStatus,
    {
      key: "inLesson",
      label: "上課中",
      count: allStudents.filter((s) => s.isInActiveLesson).length,
      active: filters.inActiveLesson,
      toggle: () => toggleFlag("inActiveLesson"),
    },
    {
      key: "noCard",
      label: "沒有課卡",
      count: allStudents.filter((s) => remainingSessions(s) === 0).length,
      active: filters.noActiveCard,
      toggle: () => toggleFlag("noActiveCard"),
    },
  ];

  // 「更多篩選」上的數字：只算快篩 chip 看不到的條件，免得跟亮起來的 chip 重複計數
  const quickActiveCount = quickStatus.filter((option) => option.active).length;
  const hiddenActiveCount = activeCount - quickActiveCount;

  const quickChips = (size: "sm" | "md") => (
    <>
      {quickStatus.map((quick) => (
        <FilterChip
          key={quick.key}
          size={size}
          active={quick.active}
          alert={quick.alert}
          count={quick.count}
          onClick={quick.toggle}
        >
          {quick.label}
        </FilterChip>
      ))}
    </>
  );

  // 搜尋是後端做的，所以 allStudents 空掉可能是「教室真的沒人」也可能是
  // 「這組關鍵字沒中」——用有沒有下條件來分辨，別對著搜不到的人喊「還沒有學生」。
  const isNarrowed = query.trim().length > 0 || activeCount > 0;

  const resultBar = (
    <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
      <span>
        {isNarrowed ? `符合 ${students.length} 位` : `共 ${students.length} 位`}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-2 font-semibold text-primary-700 hover:text-primary-900 cursor-pointer"
          >
            清除條件
          </button>
        )}
      </span>
      <SortMenu sort={sort} options={SORT_OPTIONS} onChange={setSort} />
    </div>
  );

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
      sort={sort}
      onSortChange={setSort}
      statusOptions={statusOptions}
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
                {allStudents.length} 位
              </span>
            </h2>
            <NewStudent />
          </div>

          <Searchbar onSearch={setQuery} inputRef={searchInputRef} compact />

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {quickChips("sm")}
            <FilterChip
              size="sm"
              active={hiddenActiveCount > 0}
              count={hiddenActiveCount > 0 ? hiddenActiveCount : undefined}
              onClick={() => setDrawerOpen(true)}
            >
              <SlidersHorizontal className="w-3 h-3" />
              更多篩選
            </FilterChip>
          </div>

          <div className="mt-2">{resultBar}</div>
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
          <ArchivedStudents className="px-4 py-3" />
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
    <div className="py-3">
      <div className="px-4 flex flex-col gap-2.5 pb-2.5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            學生
            <span className="ml-1.5 text-[13px] font-medium text-neutral-500">
              {allStudents.length} 位
            </span>
          </h2>
          <NewStudent />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <Searchbar onSearch={setQuery} />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={
              activeCount > 0 ? `篩選與排序，已套用 ${activeCount} 個條件` : "篩選與排序"
            }
            className="relative shrink-0 w-11 h-11 grid place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:border-primary-300 cursor-pointer"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full border-2 border-white bg-primary-700 text-white text-[11px] font-bold">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* 快篩：一排橫向捲動，不換行，名單才不會被往下推 */}
        <div className="-mx-4 px-4 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {quickChips("sm")}
        </div>
      </div>

      <div className="px-4 py-1.5 bg-neutral-50 border-b border-neutral-100">{resultBar}</div>

      {students.length === 0 && <div className="p-4">{emptyState}</div>}

      <div className="flex flex-col">
        {students.map((student) => (
          <SingleStudent key={student.id} student={student} />
        ))}
      </div>

      <ArchivedStudents className="px-4 py-4" />

      {drawer}
    </div>
  );
};

export default StudentList;
