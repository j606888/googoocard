"use client";

import { AlarmClock, BookOpenText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/skeletons/ListSkeleton";
import FinishedLessons from "./FinishedLessons";
import TabAndSort from "./TabAndSort";
import LessonTable from "./LessonTable";
import LessonGroupSection from "./LessonGroupSection";
import Drawer from "@/components/Drawer";
import { useState } from "react";
import { useLessonsList } from "./useLessonsList";

const LessonsList = () => {
  const router = useRouter();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const {
    lessons,
    isLoading,
    isFetching,
    sections,
    useGroupedView,
    attention,
    isCollapsed,
    toggleSection,
    isFiltering,
    activeTab,
    setActiveTab,
    sort,
    setSort,
    search,
    setSearch,
    danceStyleId,
    setDanceStyleId,
    loadMore,
    newGroupName,
    setNewGroupName,
    createGroup,
    isCreatingGroup,
  } = useLessonsList();

  const handleCreateGroup = async () => {
    if (await createGroup()) setCreateGroupOpen(false);
  };

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6 w-full max-w-[1120px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">課程</h2>
        <button
          className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
          onClick={() => router.push("/lessons/new")}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">新增課程</span>
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
        danceStyleId={danceStyleId}
        setDanceStyleId={setDanceStyleId}
        availableDanceStyleIds={lessons?.availableDanceStyleIds ?? []}
      />

      {(attention.dueCount > 0 || attention.needsNextCount > 0) && (
        <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl bg-warning-50 border border-warning-200 text-sm text-neutral-700">
          <AlarmClock className="w-4 h-4 shrink-0 text-warning-700" />
          <span>
            {[
              attention.dueCount > 0 && `${attention.dueCount} 堂待點名`,
              attention.needsNextCount > 0 &&
                `${attention.needsNextCount} 門持續開課的課還沒排下一堂`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : lessons?.lessons.length === 0 && !useGroupedView ? (
        <div className="flex flex-col items-center justify-center p-8 gap-3 bg-primary-50 rounded-2xl">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <BookOpenText className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">
              {isFiltering ? "沒有符合的課程" : "還沒有課程"}
            </p>
            <p className="text-sm text-neutral-500 text-center">
              {isFiltering
                ? "換個關鍵字或篩選再試試。"
                : "建立課程就可以開始上課了！"}
            </p>
          </div>
        </div>
      ) : useGroupedView ? (
        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <LessonGroupSection
              key={section.id}
              section={section}
              collapsed={isCollapsed(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
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
          {activeTab === "finished" && !isFiltering ? (
            <FinishedLessons lessons={lessons?.lessons ?? []} />
          ) : (
            <LessonTable
              lessons={lessons?.lessons ?? []}
              variant={activeTab === "finished" ? "finished" : "active"}
            />
          )}
          {lessons?.hasNextPage && (
            <div className="flex justify-center mt-5">
              <button
                onClick={loadMore}
                disabled={isFetching}
                className="px-5 py-2 rounded-full border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {isFetching ? "載入中…" : "載入更多"}
              </button>
            </div>
          )}
        </>
      )}

      <Drawer
        title="新增群組"
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSubmit={handleCreateGroup}
        isLoading={isCreatingGroup}
      >
        <form>
          <label className="block mb-2 font-medium">名稱</label>
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
