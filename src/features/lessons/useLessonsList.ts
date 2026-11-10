"use client";

import { useMemo, useState } from "react";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
} from "@/store/slices/lessonGroups";
import { buildSeries, filterSeries, splitSeries } from "./lessonSeries";
import type { LessonScope } from "./useLessonScope";

export type SeriesTab = "active" | "inactive";

/**
 * 「所有課程」的資料與篩選狀態：整間教室的課一次抓回來，依課種（`LessonGroup`）
 * 排成 課種 → 期，篩選都在前端做。純推導在 `lessonSeries.ts`。
 *
 * `scope`（我的課／分部）是頁面層級的，跟「接下來」共用；這裡自己的是搜尋、舞種、分頁。
 */
export const useLessonsList = (scope: LessonScope, myTeacherId: number | null) => {
  const [tab, setTab] = useState<SeriesTab>("active");
  const [search, setSearch] = useState("");
  const [danceStyleId, setDanceStyleId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const { data: groups, isLoading: isGroupsLoading } = useGetLessonGroupsQuery();
  // tab="all" 不帶 page = 不分頁：各期的編號要看到同課種全部的課才排得出來。
  const { data, isLoading } = useGetLessonsQuery({ tab: "all", sort: "name" });
  const [createLessonGroup, { isLoading: isCreatingGroup }] = useCreateLessonGroupMutation();

  const all = useMemo(
    () => buildSeries(data?.lessons ?? [], groups ?? []),
    [data?.lessons, groups]
  );
  const { active, inactive } = useMemo(
    () =>
      splitSeries(
        filterSeries(all, {
          search,
          danceStyleId,
          locationId: scope.locationId,
          teacherId: scope.mine ? myTeacherId : null,
        })
      ),
    [all, search, danceStyleId, scope.locationId, scope.mine, myTeacherId]
  );

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return false;
    await createLessonGroup({ name });
    setNewGroupName("");
    return true;
  };

  return {
    isLoading: isLoading || isGroupsLoading,
    /** 這間教室一門課都沒有（不是被篩掉）。 */
    hasNoLessons: !isLoading && (data?.lessons.length ?? 0) === 0,
    series: tab === "active" ? active : inactive,
    counts: { active: active.length, inactive: inactive.length },
    availableDanceStyleIds: data?.availableDanceStyleIds ?? [],
    availableLocationIds: data?.availableLocationIds ?? [],
    isFiltering: Boolean(search.trim() || danceStyleId),
    tab,
    setTab,
    search,
    setSearch,
    danceStyleId,
    setDanceStyleId,
    newGroupName,
    setNewGroupName,
    createGroup,
    isCreatingGroup,
  };
};
