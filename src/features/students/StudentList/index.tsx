"use client";

import FilterChip from "@/components/FilterChip";
import NewStudent from "./NewStudent";
import { Student, useGetStudentsQuery, useGetTagsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import StudentTable, { StudentTableSkeleton } from "./StudentTable";
import ActivityTabs, { ACTIVITY_META } from "./ActivityTabs";
import Searchbar from "./Searchbar";
import SortMenu, { SortDirection } from "@/components/SortMenu";
import FilterDrawer, { StatusFilterOption } from "./FilterDrawer";
import ArchivedStudents from "./ArchivedStudents";
import UnboundLineEntry from "./UnboundLineEntry";
import { useState, useMemo, useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import {
  StudentFilters,
  StudentSort,
  StudentActivity,
  ActivityView,
  activityOf,
  loadActivityView,
  saveActivityView,
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
  loadStudentSortDirection,
  saveStudentSort,
  saveStudentSortDirection,
  remainingSessions,
  sortStudents,
} from "./studentFilters";

interface StudentListProps {
  /**
   * "page"  —— 手機：卡片式名單，點了進整頁學生詳情。
   * "table" —— 桌面：全寬表格，點了開右側抽屜；選取狀態由外部持有。
   */
  variant?: "page" | "table";
  selectedId?: number | null;
  onSelect?: (student: Student) => void;
}

const ACTIVITY_ORDER: StudentActivity[] = ["active", "idle", "gone"];

const StudentList = ({ variant = "page", selectedId = null, onSelect }: StudentListProps) => {
  const isTable = variant === "table";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<StudentSort>(DEFAULT_SORT);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // 換排序欄位就回到那個欄位的預設方向，免得「剩餘堂數」突然變成多到少
  const changeSort = (next: StudentSort) => {
    if (next !== sort) setSortDirection("asc");
    setSort(next);
  };
  const [activityView, setActivityView] = useState<ActivityView>("all");
  const [showGone, setShowGone] = useState(false);
  const [hydratedClassroomId, setHydratedClassroomId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setSortDirection(loadStudentSortDirection(classroomId));
    setActivityView(loadActivityView(classroomId));
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
    saveStudentSortDirection(classroomId, sortDirection);
  }, [classroomId, hydratedClassroomId, sort, sortDirection]);

  useEffect(() => {
    if (classroomId == null || hydratedClassroomId !== classroomId) return;
    saveActivityView(classroomId, activityView);
  }, [classroomId, hydratedClassroomId, activityView]);

  const students = useMemo(
    () => sortStudents(applyStudentFilters(allStudents, filters), sort, sortDirection),
    [allStudents, filters, sort, sortDirection]
  );

  // 分區：篩選、排序之後才切。有搜尋字時不分區——找人就是找人，不該被藏在收起來的區裡。
  const isSearching = query.trim().length > 0;
  const byActivity = useMemo(() => {
    const groups: Record<StudentActivity, Student[]> = { active: [], idle: [], gone: [] };
    for (const student of students) groups[activityOf(student)].push(student);
    return groups;
  }, [students]);

  const sections = useMemo(() => {
    if (isSearching) return [{ key: "search" as const, students }];
    const keys = activityView === "all" ? ACTIVITY_ORDER : [activityView];
    return keys.map((key) => ({ key, students: byActivity[key] }));
  }, [isSearching, students, activityView, byActivity]);

  // 畫面上看得到的順序（「已離開」收起來時不算），↑↓ 換人用。
  const visibleStudents = useMemo(
    () =>
      sections.flatMap((section) =>
        section.key === "gone" && activityView === "all" && !showGone ? [] : section.students
      ),
    [sections, activityView, showGone]
  );

  // table 鍵盤操作：/ 聚焦搜尋；抽屜開著時 ↑↓ 換人（Esc 關抽屜由 SideSheet 處理）
  useEffect(() => {
    if (!isTable) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        !!active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable);
      if (isTyping) {
        if (event.key === "Escape" && selectedId == null) active?.blur();
        return;
      }

      if (event.key === "/" && selectedId == null) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && selectedId != null) {
        const index = visibleStudents.findIndex((s) => s.id === selectedId);
        if (index < 0) return;
        event.preventDefault();
        const next =
          event.key === "ArrowDown"
            ? Math.min(index + 1, visibleStudents.length - 1)
            : Math.max(index - 1, 0);
        onSelect?.(visibleStudents[next]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTable, visibleStudents, selectedId, onSelect]);

  // 抽屜裡換人時，把名單上的那一列捲進視野（抽屜後面還看得到名單）
  useEffect(() => {
    if (!isTable || selectedId == null) return;
    document
      .querySelector(`[data-student-list] [aria-current="true"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isTable, selectedId]);

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
          <Button
            type="button"
            variant="link"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-2 text-xs font-semibold"
          >
            清除條件
          </Button>
        )}
      </span>
      <SortMenu
        sort={sort}
        options={SORT_OPTIONS}
        onChange={changeSort}
        direction={sortDirection}
        onDirectionChange={setSortDirection}
      />
    </div>
  );

  const emptyState = isNarrowed ? (
    <EmptyState
      kind="filtered"
      title="找不到符合的學生"
      description="換個關鍵字，或清掉上面的篩選條件"
      action={
        activeCount > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            清除篩選
          </Button>
        )
      }
    />
  ) : (
    <EmptyState kind="page" title="還沒有學生" description="建立學生後就可以開始上課" />
  );

  // 載入中：分區卡和快篩的數字還不知道，畫同樣大小的骨架，資料進來不會跳。
  const activitySkeleton = (
    <div aria-hidden="true" className="grid grid-cols-4 gap-1.5 lg:gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[60px] lg:h-[92px] rounded-xl" />
      ))}
    </div>
  );
  const chipSkeletons = ["w-20", "w-24", "w-16", "w-28"].map((width) => (
    <Skeleton key={width} aria-hidden="true" className={`h-[26px] shrink-0 ${width}`} />
  ));

  const drawer = (
    <FilterDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      filters={filters}
      onChange={setFilters}
      sort={sort}
      onSortChange={changeSort}
      sortDirection={sortDirection}
      onSortDirectionChange={setSortDirection}
      statusOptions={statusOptions}
      tags={tags}
      lessons={inProgressLessons}
      availableQualifications={availableQualifications}
      resultCount={students.length}
    />
  );

  const activityCounts: Record<StudentActivity, number> = {
    active: byActivity.active.length,
    idle: byActivity.idle.length,
    gone: byActivity.gone.length,
  };

  const list =
    isLoading ? (
      <StudentTableSkeleton />
    ) : students.length === 0 ? (
      <div className="p-4 lg:p-0">{emptyState}</div>
    ) : (
      <div data-student-list className="flex flex-col gap-4 lg:gap-6">
        {sections.map((section, index) => {
          const meta = section.key === "search" ? null : ACTIVITY_META[section.key];
          // 「全部」時已離開那區預設收起來；單獨點進「已離開」就整區展開。
          const collapsible = section.key === "gone" && activityView === "all";
          const open = !collapsible || showGone;
          return (
            <section key={section.key} aria-label={meta?.label ?? "搜尋結果"}>
              {meta && (activityView === "all" || section.students.length === 0) && (
                <div className="flex items-center gap-2 px-4 lg:px-1 pb-2">
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <h3 className="text-sm font-semibold text-neutral-900">{meta.label}</h3>
                  <span className="text-xs text-neutral-500 truncate">
                    {section.students.length} 位
                    <span className="hidden sm:inline"> · {section.key === "idle" ? "已付錢但沒在用" : meta.desc}</span>
                  </span>
                  {collapsible && section.students.length > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      aria-expanded={open}
                      onClick={() => setShowGone((v) => !v)}
                      className="ml-auto px-1 py-1 text-xs font-semibold"
                    >
                      {open ? "收起" : `展開 ${section.students.length} 位`}
                    </Button>
                  )}
                </div>
              )}
              {open &&
                (section.students.length > 0 ? (
                  <StudentTable
                    students={section.students}
                    selectedId={selectedId}
                    onSelect={isTable ? onSelect : undefined}
                    hideHeader={index > 0}
                  />
                ) : (
                  <EmptyState kind="inline" title="沒有學生" className="mx-4 lg:mx-0" />
                ))}
            </section>
          );
        })}
      </div>
    );

  if (isTable) {
    return (
      <div className="px-8 py-7 flex flex-col gap-5 max-w-[1440px]">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-bold">
            學生
            {!isLoading && (
              <span className="ml-2 text-sm font-normal text-neutral-500">共 {allStudents.length} 位</span>
            )}
          </h2>
          <div className="flex-1 min-w-[240px] max-w-md">
            <Searchbar onSearch={setQuery} inputRef={searchInputRef} compact />
          </div>
          <div className="ml-auto">
            <NewStudent />
          </div>
        </div>

        {isLoading
          ? activitySkeleton
          : !isSearching && (
              <ActivityTabs value={activityView} onChange={setActivityView} counts={activityCounts} />
            )}

        <div className="flex flex-wrap items-center gap-1.5">
          {isLoading ? chipSkeletons : quickChips("sm")}
          <FilterChip
            size="sm"
            active={hiddenActiveCount > 0}
            count={hiddenActiveCount > 0 ? hiddenActiveCount : undefined}
            onClick={() => setDrawerOpen(true)}
          >
            <SlidersHorizontal className="w-3 h-3" />
            更多篩選
          </FilterChip>
          <div className="ml-auto min-w-[220px]">{resultBar}</div>
        </div>

        {list}

        <div className="flex flex-col gap-3">
          <UnboundLineEntry />
          <ArchivedStudents />
        </div>

        {drawer}
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="px-4 flex flex-col gap-2.5 pb-2.5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            學生
            {!isLoading && (
              <span className="ml-1.5 text-[13px] font-medium text-neutral-500">
                {allStudents.length} 位
              </span>
            )}
          </h2>
          <NewStudent />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <Searchbar onSearch={setQuery} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label={
              activeCount > 0 ? `篩選與排序，已套用 ${activeCount} 個條件` : "篩選與排序"
            }
            className="relative size-12 border-neutral-300 text-neutral-700 hover:border-primary-300 hover:bg-white"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full border-2 border-white bg-primary-900 text-white text-[11px] font-bold">
                {activeCount}
              </span>
            )}
          </Button>
        </div>

        {isLoading
          ? activitySkeleton
          : !isSearching && (
              <ActivityTabs value={activityView} onChange={setActivityView} counts={activityCounts} />
            )}

        {/* 快篩：一排橫向捲動，不換行，名單才不會被往下推 */}
        <div className="-mx-4 px-4 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {isLoading ? chipSkeletons : quickChips("sm")}
        </div>
      </div>

      <div className="px-4 py-1.5 mb-3 bg-neutral-50 border-b border-neutral-100">{resultBar}</div>

      {list}

      <UnboundLineEntry className="px-4 pt-4" />
      <ArchivedStudents className="px-4 py-4" />

      {drawer}
    </div>
  );
};

export default StudentList;
