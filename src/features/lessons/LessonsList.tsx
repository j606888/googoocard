"use client";

import { BookOpenText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGetLessonsQuery, LessonSummary } from "@/store/slices/lessons";
import {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
} from "@/store/slices/lessonGroups";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import TabAndSort from "./TabAndSort";
import LessonCard from "./LessonCard";
import GroupCard, { GroupCardData } from "./GroupCard";
import Drawer from "@/components/Drawer";
import { useEffect, useMemo, useState } from "react";
import { DanceType } from "@prisma/client";

// Folds a group's member LessonSummary rows into the card's status line —
// pure client-side aggregation over fields the /lessons list already
// computes per lesson (summarizeLessonPeriods), no extra backend rollup.
const summarizeGroup = (
  id: number | "ungrouped",
  name: string,
  lessons: LessonSummary[]
): GroupCardData => ({
  id,
  name,
  lessonCount: lessons.length,
  studentCount: lessons.reduce((sum, l) => sum + l.studentCount, 0),
  danceTypes: [...new Set(lessons.map((l) => l.danceType))],
  dueForAttendanceCount: lessons.reduce((sum, l) => sum + l.dueForAttendanceCount, 0),
  nextSessionDate:
    lessons
      .map((l) => l.nextSessionDate)
      .filter((d): d is string => d !== null)
      .sort()[0] ?? null,
});

const LessonsList = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inProgress");
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [danceType, setDanceType] = useState<DanceType | null>(null);
  const [page, setPage] = useState(1);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
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
  const [createLessonGroup, { isLoading: isCreatingGroup }] = useCreateLessonGroupMutation();

  // A query or dance-type filter flattens to the classic per-lesson list —
  // matches "find a specific class" intent regardless of which group it's
  // in. Otherwise, once at least one group exists, browse by group; a
  // classroom that has never created a group sees today's flat list
  // unchanged (nothing to group by yet).
  const isFlattened = Boolean(debouncedSearch || danceType);
  const useGroupedView = !isFlattened && (groups?.length ?? 0) > 0;

  // Pure client-side rollup over the already-fetched LessonSummary rows
  // (each already carries summarizeLessonPeriods' due/next-session fields) —
  // no dedicated group-summary endpoint needed. Assumes a classroom's
  // in-progress lesson count comfortably fits one unpaginated fetch (true
  // for a single dance studio's schedule).
  const groupCards = useMemo<GroupCardData[]>(() => {
    if (!useGroupedView || !lessons) return [];
    const byGroup = new Map<number, LessonSummary[]>();
    const ungrouped: LessonSummary[] = [];
    for (const lesson of lessons.lessons) {
      if (lesson.groupId === null) {
        ungrouped.push(lesson);
      } else {
        const list = byGroup.get(lesson.groupId);
        if (list) list.push(lesson);
        else byGroup.set(lesson.groupId, [lesson]);
      }
    }
    const cards = (groups ?? []).map((g) => summarizeGroup(g.id, g.name, byGroup.get(g.id) ?? []));
    if (ungrouped.length > 0) {
      cards.push(summarizeGroup("ungrouped", "未分類", ungrouped));
    }
    return cards;
  }, [useGroupedView, lessons, groups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await createLessonGroup({ name: newGroupName.trim() });
    setCreateGroupOpen(false);
    setNewGroupName("");
  };

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Lessons</h2>
        <button
          className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
          onClick={() => router.push("/lessons/new")}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">New Lesson</span>
        </button>
      </div>

      <TabAndSort
        tabsCount={lessons?.tabsCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sort={sort}
        setSort={setSort}
        search={search}
        setSearch={setSearch}
        danceType={danceType}
        setDanceType={setDanceType}
        availableDanceTypes={lessons?.availableDanceTypes ?? []}
      />

      {isLoading ? (
        <ListSkeleton />
      ) : lessons?.lessons.length === 0 && !useGroupedView ? (
        <div className="flex flex-col items-center justify-center p-8 gap-3 bg-primary-50 rounded-2xl">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <BookOpenText className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">
              {debouncedSearch || danceType ? "No matching lessons" : "No lessons yet"}
            </p>
            <p className="text-sm text-neutral-500 text-center">
              {debouncedSearch || danceType
                ? "Try a different search or filter."
                : "Create lesson to start teaching!"}
            </p>
          </div>
        </div>
      ) : useGroupedView ? (
        <div className="flex flex-col gap-3">
          {groupCards.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
          <button
            onClick={() => setCreateGroupOpen(true)}
            className="flex items-center justify-center gap-2 border border-dashed border-neutral-300 rounded-2xl text-neutral-500 py-3 text-sm font-semibold cursor-pointer hover:border-neutral-400 hover:text-neutral-700"
          >
            <Plus className="w-4 h-4" />
            新增群組
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {lessons?.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
          {lessons?.hasNextPage && (
            <div className="flex justify-center mt-5">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="px-5 py-2 rounded-full border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {isFetching ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      <Drawer
        title="Create Group"
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={handleCreateGroup}
        isLoading={isCreatingGroup}
      >
        <form>
          <label className="block mb-2 font-medium">Name</label>
          <input
            className="w-full mb-4 p-2 rounded bg-neutral-100 focus:outline-primary-500"
            placeholder="例如：週日課"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
        </form>
      </Drawer>
    </div>
  );
};

export default LessonsList;
