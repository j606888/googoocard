"use client";

import { useEffect, useMemo, useState } from "react";
import { DanceType } from "@prisma/client";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
} from "@/store/slices/lessonGroups";
import { buildGroupRows, shouldUseGroupedView } from "./lessonGrouping";

/**
 * 課程列表的資料、篩選狀態與群組彙總。元件只剩排版。
 * 純推導（彙總、檢視模式規則）在 `lessonGrouping.ts`。
 */
export const useLessonsList = () => {
  const [activeTab, setActiveTab] = useState("inProgress");
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [page, setPage] = useState(1);
  const [newGroupName, setNewGroupName] = useState("");

  // Debounce the search input before it hits the query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change restarts pagination from the first page.
  useEffect(() => {
    setPage(1);
  }, [activeTab, sort, debouncedSearch, danceType]);

  const { data: lessons, isLoading, isFetching } = useGetLessonsQuery({
    tab: activeTab,
    sort,
    search: debouncedSearch,
    danceType,
    page,
  });
  const { data: groups } = useGetLessonGroupsQuery();
  const [createLessonGroup, { isLoading: isCreatingGroup }] =
    useCreateLessonGroupMutation();

  const useGroupedView = shouldUseGroupedView(
    debouncedSearch,
    danceType,
    groups?.length ?? 0
  );

  // Assumes a classroom's in-progress lesson count comfortably fits one
  // unpaginated fetch (true for a single dance studio's schedule).
  const groupRows = useMemo(
    () =>
      useGroupedView && lessons
        ? buildGroupRows(lessons.lessons, groups ?? [])
        : [],
    [useGroupedView, lessons, groups]
  );

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return false;
    await createLessonGroup({ name });
    setNewGroupName("");
    return true;
  };

  return {
    lessons,
    isLoading,
    isFetching,
    groupRows,
    useGroupedView,
    /** 有在篩選（關鍵字或舞種）——空狀態的文案靠它分岔。 */
    isFiltering: Boolean(debouncedSearch || danceType),
    activeTab,
    setActiveTab,
    sort,
    setSort,
    search,
    setSearch,
    danceType,
    setDanceType,
    loadMore: () => setPage((p) => p + 1),
    newGroupName,
    setNewGroupName,
    createGroup,
    isCreatingGroup,
  };
};
