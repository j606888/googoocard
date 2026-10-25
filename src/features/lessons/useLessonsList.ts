"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
} from "@/store/slices/lessonGroups";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import {
  buildLessonSections,
  listAttention,
  shouldUseGroupedView,
  type SectionId,
} from "./lessonGrouping";

const collapsedKey = (classroomId: number) => `lesson-groups-collapsed:${classroomId}`;

const loadCollapsed = (classroomId: number): SectionId[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(collapsedKey(classroomId)) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCollapsed = (classroomId: number, ids: SectionId[]) => {
  try {
    localStorage.setItem(collapsedKey(classroomId), JSON.stringify(ids));
  } catch {
    // Storage unavailable — collapse just won't survive a reload.
  }
};

/**
 * 課程列表的資料、篩選狀態、分組與收合。元件只剩排版。
 * 純推導（分組、每列動作、提醒）在 `lessonGrouping.ts`。
 */
export const useLessonsList = () => {
  const [activeTab, setActiveTab] = useState("inProgress");
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [danceStyleId, setDanceStyleId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [newGroupName, setNewGroupName] = useState("");
  const [collapsed, setCollapsed] = useState<SectionId[]>([]);

  const { data: classroomData } = useGetClassroomsQuery();
  const classroomId = classroomData?.currentClassroomId;

  useEffect(() => {
    if (classroomId != null) setCollapsed(loadCollapsed(classroomId));
  }, [classroomId]);

  // Debounce the search input before it hits the query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change restarts pagination from the first page.
  useEffect(() => {
    setPage(1);
  }, [activeTab, sort, debouncedSearch, danceStyleId, locationId]);

  const { data: groups, isLoading: isGroupsLoading } = useGetLessonGroupsQuery();
  const useGroupedView = shouldUseGroupedView(
    debouncedSearch,
    // Any chip filter flattens the grouped view the same way.
    danceStyleId ?? locationId,
    groups?.length ?? 0,
    activeTab
  );

  // The grouped view shows every in-progress lesson at once (a studio's
  // running schedule fits one fetch); only the flat list paginates.
  const { data: lessons, isLoading, isFetching } = useGetLessonsQuery({
    tab: activeTab,
    sort,
    search: debouncedSearch,
    danceStyleId,
    locationId,
    page: useGroupedView ? undefined : page,
  }, {
    // Wait for the groups: they decide paged vs. unpaged, so fetching early
    // would load the first page and then refetch everything.
    skip: isGroupsLoading,
  });
  const [createLessonGroup, { isLoading: isCreatingGroup }] =
    useCreateLessonGroupMutation();

  const sections = useMemo(
    () =>
      useGroupedView && lessons
        ? buildLessonSections(lessons.lessons, groups ?? [])
        : [],
    [useGroupedView, lessons, groups]
  );

  const attention = useMemo(
    () =>
      activeTab === "inProgress" && lessons
        ? listAttention(lessons.lessons)
        : { dueCount: 0, needsNextCount: 0 },
    [activeTab, lessons]
  );

  const toggleSection = (id: SectionId) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (classroomId != null) saveCollapsed(classroomId, next);
      return next;
    });
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return false;
    await createLessonGroup({ name });
    setNewGroupName("");
    return true;
  };

  return {
    lessons,
    isLoading: isLoading || isGroupsLoading,
    isFetching,
    sections,
    useGroupedView,
    attention,
    isCollapsed: (id: SectionId) => collapsed.includes(id),
    toggleSection,
    /** 有在篩選（關鍵字或舞種）——空狀態的文案靠它分岔。 */
    isFiltering: Boolean(debouncedSearch || danceStyleId || locationId),
    activeTab,
    setActiveTab,
    sort,
    setSort,
    search,
    setSearch,
    danceStyleId,
    setDanceStyleId,
    locationId,
    setLocationId,
    loadMore: () => setPage((p) => p + 1),
    newGroupName,
    setNewGroupName,
    createGroup,
    isCreatingGroup,
  };
};
