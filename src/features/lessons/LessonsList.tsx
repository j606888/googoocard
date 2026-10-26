"use client";

import { AlarmClock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import FinishedLessons from "./FinishedLessons";
import TabAndSort from "./TabAndSort";
import LessonTable, { LessonTableSkeleton } from "./LessonTable";
import LessonGroupSection from "./LessonGroupSection";
import Drawer from "@/components/Drawer";
import { useState } from "react";
import { useLessonsList } from "./useLessonsList";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import Field from "@/components/Field";

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
    locationId,
    setLocationId,
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
        <h2 className="text-2xl font-bold text-neutral-900">課程</h2>
        <Button onClick={() => router.push("/lessons/new")}>
          <Plus />
          新增課程
        </Button>
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
        locationId={locationId}
        setLocationId={setLocationId}
        availableLocationIds={lessons?.availableLocationIds ?? []}
      />

      {(attention.dueCount > 0 || attention.needsNextCount > 0) && (
        <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl bg-warning-50 border border-warning-300 text-sm text-warning-950">
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
        <LessonTableSkeleton />
      ) : lessons?.lessons.length === 0 && !useGroupedView ? (
        isFiltering ? (
          <EmptyState
            kind="filtered"
            title={search.trim() ? `沒有符合「${search.trim()}」的課程` : "沒有符合的課程"}
            description="換個關鍵字或篩選再試試。"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDanceStyleId(null);
                  setLocationId(null);
                }}
              >
                清除篩選
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="還沒有課程"
            description="建立課程就可以開始上課了！"
            action={
              <Button onClick={() => router.push("/lessons/new")}>
                <Plus />
                新增課程
              </Button>
            }
          />
        )
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
          <Button
            onClick={() => setCreateGroupOpen(true)}
            variant="ghost"
            className="w-full h-12 rounded-2xl border-[1.5px] border-dashed border-neutral-300 text-neutral-500 hover:bg-transparent hover:border-neutral-400 hover:text-neutral-700"
          >
            <Plus className="w-4 h-4" />
            新增群組
          </Button>
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
              <Button variant="secondary" size="sm" onClick={loadMore} isLoading={isFetching}>
                {isFetching ? "載入中…" : "載入更多"}
              </Button>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateGroup();
          }}
        >
          <Field
            label="名稱"
            className="mb-4"
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
