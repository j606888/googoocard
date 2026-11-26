"use client";

import NewStudent from "./NewStudent";
import { Student, useGetStudentsQuery, useGetTagsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import StudentTable, { StudentTableSkeleton } from "./StudentTable";
import ActivityTabs, { ACTIVITY_META, ActivityInfoTip } from "./ActivityTabs";
import Searchbar from "./Searchbar";
import type { SortDirection } from "@/components/SortMenu";
import Select from "@/components/Select";
import FilterDrawer, { StatusFilterOption } from "./FilterDrawer";
import ArchivedStudents from "./ArchivedStudents";
import UnboundLineEntry from "./UnboundLineEntry";
import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { cn } from "@/lib/utils";
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
  NEEDS_RENEWAL_LABEL,
  NEEDS_RENEWAL_TAG,
  applyStudentFilters,
  countActiveFilters,
  isLowRemaining,
  lessonOptionLabel,
  loadStudentFilters,
  pruneStudentFilters,
  saveStudentFilters,
  loadStudentSort,
  loadStudentSortDirection,
  saveStudentSort,
  saveStudentSortDirection,
  sortStudents,
} from "./studentFilters";

interface StudentListProps {
  /**
   * "page"  —— 手機：兩行的清單列，點了進整頁學生詳情；排序收在「篩選與排序」抽屜。
   * "table" —— 桌面：全寬表格，點了開右側抽屜；選取狀態由外部持有。
   */
  variant?: "page" | "table";
  selectedId?: number | null;
  onSelect?: (student: Student) => void;
  /** table：目前篩選＋排序後的名單順序，給抽屜頂列的上一位／下一位用。 */
  onVisibleChange?: (students: Student[]) => void;
}

const ACTIVITY_ORDER: StudentActivity[] = ["active", "idle", "gone"];

/** 「上的課」選單的第一項；課的 id 從 1 起跳，0 不會撞到。 */
const ALL_LESSONS = 0;

/** 載入中的名單。要是同一個陣列：每次 render 給新的 `[]` 會讓 `onVisibleChange` 一直觸發，變成無限更新。 */
const NO_STUDENTS: Student[] = [];

const StudentList = ({ variant = "page", selectedId = null, onSelect, onVisibleChange }: StudentListProps) => {
  const isTable = variant === "table";
  const [query, setQuery] = useState("");
  // 存起來的條件原樣放這裡；真正拿去篩的是下面修剪過的 `filters`。
  const [savedFilters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
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

  const { data: allStudents = NO_STUDENTS, isLoading } = useGetStudentsQuery({ query });
  const { data: lessonsData } = useGetLessonsQuery({ tab: "inProgress", sort: "createdAt" });
  const { data: tags } = useGetTagsQuery();
  const { data: classroomData } = useGetClassroomsQuery();
  const classroomId = classroomData?.currentClassroomId;
  const { locations } = useLocations();
  const { byId: danceStylesById, isLoading: danceStylesLoading } = useDanceStyles();

  // 「上的課」：進行中的課，教室有兩個以上分部時名字後面帶分部。
  const showLessonLocation = locations.length >= 2;
  const lessonOptions = useMemo(
    () =>
      (lessonsData?.lessons ?? [])
        .map((lesson) => ({ value: lesson.id, label: lessonOptionLabel(lesson, showLessonLocation) }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant")),
    [lessonsData, showLessonLocation]
  );

  // 已經選不到的條件（課結束了、標籤刪了）不算數，免得名單被一個關不掉的條件濾短。
  const filters = useMemo(
    () =>
      pruneStudentFilters(savedFilters, {
        lessonIds: lessonsData?.lessons.map((lesson) => lesson.id),
        tagNames: tags?.map((tag) => tag.name),
        qualificationIds: danceStylesLoading ? undefined : [...danceStylesById.keys()],
      }),
    [savedFilters, lessonsData, tags, danceStylesLoading, danceStylesById]
  );

  // 學生資格中實際存在的舞種，動態決定「舞種資格」可選項（依教室的舞種順序）；
  // 已經勾著的一定列出來，才關得掉。
  const availableQualifications = useMemo(
    () =>
      [...danceStylesById.values()].filter(
        (style) =>
          filters.qualifications.includes(style.id) ||
          allStudents.some((s) => s.danceQualifications?.includes(style.id))
      ),
    [allStudents, danceStylesById, filters.qualifications]
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
    saveStudentFilters(classroomId, savedFilters);
  }, [classroomId, hydratedClassroomId, savedFilters]);

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
      // 下拉選單（上的課、排序）自己會用到 ↑↓，焦點在上面時不搶。
      const isTyping =
        !!active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.getAttribute("role") === "combobox" ||
          active.isContentEditable);
      if (isTyping) {
        if (event.key === "Escape" && selectedId == null && active?.tagName === "INPUT") active.blur();
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

  useEffect(() => {
    if (isTable) onVisibleChange?.(visibleStudents);
  }, [isTable, visibleStudents, onVisibleChange]);

  // 抽屜裡換人時，把名單上的那一列捲進視野（抽屜後面還看得到名單）
  useEffect(() => {
    if (!isTable || selectedId == null) return;
    document
      .querySelector(`[data-student-list] [aria-current="true"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isTable, selectedId]);

  const activeCount = countActiveFilters(filters);

  const toggleFlag = (key: "lowRemaining" | "unpaid" | "lineUnbound") =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  // 「已經沒卡」＝系統維護的 Needs Renewal 標籤；教室還沒出現過這個標籤就不放開關。
  const hasNeedsRenewalTag = tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG) ?? false;
  const renewalActive = filters.tags.includes(NEEDS_RENEWAL_TAG);
  const renewalCount = allStudents.filter((s) =>
    s.tags?.some((t) => t.name === NEEDS_RENEWAL_TAG)
  ).length;
  const toggleRenewal = () =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(NEEDS_RENEWAL_TAG)
        ? f.tags.filter((t) => t !== NEEDS_RENEWAL_TAG)
        : [...f.tags, NEEDS_RENEWAL_TAG],
    }));

  // 抽屜「條件」區。數字一律對整份名單算（不受其他條件影響），勾下去才知道會剩幾位。
  const statusOptions: StatusFilterOption[] = [
    {
      key: "low",
      label: `剩 ${LOW_REMAINING_SESSIONS} 堂以下`,
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
      key: "lineUnbound",
      label: "未綁 LINE",
      count: allStudents.filter((s) => s.lineBound === false).length,
      active: filters.lineUnbound,
      toggle: () => toggleFlag("lineUnbound"),
    },
  ];

  // 「篩選」按鈕上的數字：只算抽屜裡的條件；上的課、已經沒卡在名單上方自己看得到。
  const drawerActiveCount =
    activeCount - (filters.lessonId !== null ? 1 : 0) - (renewalActive ? 1 : 0);

  // 搜尋是後端做的，所以 allStudents 空掉可能是「教室真的沒人」也可能是
  // 「這組關鍵字沒中」——用有沒有下條件來分辨，別對著搜不到的人喊「還沒有學生」。
  const isNarrowed = isSearching || activeCount > 0;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const emptyState = isNarrowed ? (
    <EmptyState
      kind="filtered"
      title="找不到符合的學生"
      description="換個關鍵字，或清掉篩選條件"
      action={
        activeCount > 0 && (
          <Button type="button" variant="text" size="sm" onClick={clearFilters}>
            清除條件
          </Button>
        )
      }
    />
  ) : (
    <EmptyState kind="page" pose="wave" title="還沒有學生" description="建立學生後就可以開始上課" />
  );

  const activityCounts: Record<StudentActivity, number> = {
    active: byActivity.active.length,
    idle: byActivity.idle.length,
    gone: byActivity.gone.length,
  };

  const currentSort = SORT_OPTIONS.find((option) => option.value === sort);
  const directionLabel = currentSort?.directions?.[sortDirection === "desc" ? 1 : 0];

  const list = isLoading ? (
    <StudentTableSkeleton />
  ) : students.length === 0 ? (
    emptyState
  ) : (
    <div data-student-list className="flex flex-col gap-7 lg:gap-9">
      {sections.map((section, index) => {
        const meta = section.key === "search" ? null : ACTIVITY_META[section.key];
        // 「全部」時已離開那區預設收起來；單獨點進「已離開」就整區展開。
        const collapsible = section.key === "gone" && activityView === "all";
        const open = !collapsible || showGone;
        const headingId = `students-${section.key}`;
        // 只看一區時上面的分頁已經說了是哪一區，不再重複一個標題。
        const showHeading = meta !== null && activityView === "all";
        return (
          <section
            key={section.key}
            aria-labelledby={showHeading ? headingId : undefined}
            aria-label={showHeading ? undefined : (meta?.label ?? "搜尋結果")}
          >
            {showHeading && (
              <div className="mb-1 flex min-h-9 items-center gap-3">
                <h2 id={headingId} className="text-[17px] font-semibold text-ink">
                  {meta.label}
                </h2>
                <span className="text-[13px] tabular-nums text-ink-3">{section.students.length} 位</span>
                {collapsible && section.students.length > 0 && (
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    aria-expanded={open}
                    onClick={() => setShowGone((v) => !v)}
                    className="ml-auto"
                  >
                    {open ? "收起" : "展開"}
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
                <EmptyState kind="inline" title={showHeading ? "沒有學生" : "這一區沒有學生"} />
              ))}
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col px-5 pt-4 pb-10 lg:max-w-[1440px] lg:px-12 lg:pt-9">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[26px] font-semibold text-ink">學生</h1>
          <p className="min-h-5 text-[13px] tabular-nums text-ink-3">
            {!isLoading &&
              (isNarrowed ? `符合 ${students.length} 位` : `共 ${allStudents.length} 位`)}
          </p>
        </div>
        {/* 手機：搜尋自己一列、旁邊是「篩選與排序」；桌面：跟標題同一列。 */}
        <div className="order-last flex basis-full items-center gap-1 lg:order-none lg:basis-72">
          <div className="min-w-0 flex-1">
            <Searchbar onSearch={setQuery} inputRef={isTable ? searchInputRef : undefined} />
          </div>
          {!isTable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              aria-label={
                drawerActiveCount > 0
                  ? `篩選與排序，已套用 ${drawerActiveCount} 個條件`
                  : "篩選與排序"
              }
              className="relative -mr-2 text-ink-2 hover:bg-primary-50"
            >
              <SlidersHorizontal className="size-5" />
              {drawerActiveCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary-900 px-1 text-[11px] font-semibold tabular-nums text-white"
                >
                  {drawerActiveCount}
                </span>
              )}
            </Button>
          )}
        </div>
        <NewStudent />
      </div>

      {/* 分區分頁＋名單上方的篩選。手機：分頁滿版一列、篩選在下一列；桌面：同一列，底下一條線。 */}
      <div className="mt-3 lg:mt-7 lg:flex lg:items-center lg:gap-1 lg:border-b lg:border-line">
        {isLoading ? (
          <div aria-hidden="true" className="flex h-11 items-center">
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          !isSearching && (
            <div className="-mx-5 overflow-x-auto [scrollbar-width:none] lg:mx-0 lg:-ml-3.5 lg:shrink-0 lg:self-end lg:overflow-visible">
              <ActivityTabs
                value={activityView}
                onChange={setActivityView}
                counts={activityCounts}
                className="w-max min-w-full border-b border-line px-1.5 lg:min-w-0 lg:border-0 lg:px-0"
              />
            </div>
          )
        )}
        <div className="flex min-h-11 items-center gap-1 pt-1 lg:min-w-0 lg:flex-1 lg:pt-0">
          {!isLoading && !isSearching && (
            <ActivityInfoTip className="order-last ml-auto text-ink-3 hover:bg-primary-50 hover:text-ink lg:order-none lg:ml-0" />
          )}
          <span aria-hidden="true" className="hidden lg:block lg:flex-1" />
          <div className="-ml-2 flex min-w-0 flex-wrap items-center gap-x-1 lg:ml-0 lg:justify-end">
            {lessonOptions.length > 0 && (
              <Select
                size="plain"
                aria-label="上的課"
                className="w-auto max-w-[13rem] lg:max-w-[18rem]"
                value={filters.lessonId ?? ALL_LESSONS}
                onChange={(value) =>
                  setFilters((f) => ({ ...f, lessonId: value === ALL_LESSONS ? null : value }))
                }
                options={[{ value: ALL_LESSONS, label: "所有課" }, ...lessonOptions]}
              />
            )}
            {hasNeedsRenewalTag && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={renewalActive}
                onClick={toggleRenewal}
                className={cn(
                  "h-11 gap-1.5 px-2 font-medium text-ink-2 hover:bg-primary-50",
                  renewalActive && "bg-primary-50 font-semibold text-primary-800"
                )}
              >
                {renewalActive && <Check className="size-4" aria-hidden="true" />}
                {NEEDS_RENEWAL_LABEL}
                <span className="text-[13px] font-normal tabular-nums text-ink-3">{renewalCount}</span>
              </Button>
            )}
            {isTable && (
              <>
                <Select
                  size="plain"
                  aria-label="排序"
                  className="w-auto"
                  value={sort}
                  onChange={changeSort}
                  options={SORT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: `依${option.label}`,
                  }))}
                />
                {directionLabel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
                    aria-label={`排序方向：${directionLabel}，按一下反過來`}
                    className="h-11 gap-1 px-2 font-medium text-ink-2 hover:bg-primary-50"
                  >
                    {sortDirection === "desc" ? (
                      <ArrowDown className="size-4" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-4" aria-hidden="true" />
                    )}
                    {directionLabel}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    "h-11 gap-1.5 px-2 font-medium text-ink-2 hover:bg-primary-50",
                    drawerActiveCount > 0 && "font-semibold text-primary-800"
                  )}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  更多篩選
                  {drawerActiveCount > 0 && (
                    <span className="tabular-nums">
                      {drawerActiveCount}
                      <span className="sr-only"> 個條件已套用</span>
                    </span>
                  )}
                </Button>
              </>
            )}
            {activeCount > 0 && (
              <Button type="button" variant="text" size="sm" className="h-11" onClick={clearFilters}>
                清除條件
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 手機：控制區和名單之間一條淺灰帶；桌面靠留白。 */}
      <div aria-hidden="true" className="-mx-5 mt-2 mb-5 h-2 bg-band lg:hidden" />

      <div className="lg:mt-6">{list}</div>

      <div className="mt-6 flex flex-col">
        {filters.lineUnbound && <UnboundLineEntry />}
        <ArchivedStudents />
      </div>

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
        tags={tags ?? []}
        availableQualifications={availableQualifications}
        resultCount={students.length}
      />
    </div>
  );
};

export default StudentList;
