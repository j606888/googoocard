"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import FinishedLessons from "./FinishedLessons";
import TabAndSort from "./TabAndSort";
import LessonTable, { LessonTableSkeleton } from "./LessonTable";
import LessonGroupSection from "./LessonGroupSection";
import LessonHero, { LessonHeroSkeleton } from "./LessonHero";
import OverdueList from "./OverdueList";
import ActiveLessonRows, { ActiveLessonRowsSkeleton } from "./ActiveLessonRows";
import Drawer from "@/components/Drawer";
import { useState } from "react";
import { useLessonsList } from "./useLessonsList";
import { useLessonAgenda } from "./useLessonAgenda";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import Field, { fieldControlClass } from "@/components/Field";
import Navbar from "@/features/Navbar";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

type ListState = ReturnType<typeof useLessonsList>;

/**
 * 課程列表。三層、越往下越輕：深綠的主角卡（上課中／下一堂）→ 還沒點名 → 進行中的課。
 *
 * 只掛一棵樹（docs/ui-responsive.md）：手機是上面三層＋安靜的課程列；
 * 桌面保留群組、篩選與表格，主角卡和還沒點名放在表格上面。
 * 兩邊共用 `useLessonsList`（列表）與 `useLessonAgenda`（頂端）。
 */
const LessonsList = () => {
  const isExpanded = useSizeClass() === "expanded";
  const list = useLessonsList();
  return isExpanded ? <ExpandedLessons list={list} /> : <CompactLessons list={list} />;
};

/** 篩選沒有結果。 */
const FilteredEmptyState = ({ list }: { list: ListState }) => {
  const { search, setSearch, setDanceStyleId, setLocationId } = list;
  return (
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
  );
};

const NoLessonsYet = () => {
  const router = useRouter();
  return (
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
  );
};

const LoadMore = ({ list }: { list: ListState }) =>
  list.lessons?.hasNextPage ? (
    <div className="flex justify-center mt-5">
      <Button variant="secondary" size="sm" onClick={list.loadMore} isLoading={list.isFetching}>
        {list.isFetching ? "載入中…" : "載入更多"}
      </Button>
    </div>
  ) : null;

/* ───────────────────────── 手機 ───────────────────────── */

const CompactLessons = ({ list }: { list: ListState }) => {
  const router = useRouter();
  const agenda = useLessonAgenda();
  const [searchOpen, setSearchOpen] = useState(false);
  const { lessons, isLoading, activeTab, setActiveTab, search, setSearch, isFiltering } = list;

  const closeSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

  const tabsCount = lessons?.tabsCount;
  const hasNoLessons =
    !isFiltering && tabsCount && tabsCount.inProgress === 0 && tabsCount.finished === 0;
  const isFinished = activeTab === "finished";

  return (
    <>
      <Navbar
        actions={
          <Button
            variant="ghost"
            size="icon"
            aria-label="搜尋課程"
            aria-expanded={searchOpen}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            className="text-neutral-700"
          >
            <Search className="size-5.5" />
          </Button>
        }
      />
      <div className="flex w-full flex-col gap-6.5 px-5 pt-3 pb-6">
        {searchOpen && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋課程或老師"
                aria-label="搜尋課程或老師"
                className={cn(fieldControlClass(), "h-11 pl-10")}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={closeSearch} className="text-neutral-600">
              取消
            </Button>
          </div>
        )}

        {hasNoLessons ? (
          <NoLessonsYet />
        ) : (
          <>
            {!searchOpen &&
              (agenda.isLoading ? (
                <LessonHeroSkeleton />
              ) : (
                agenda.hero && <LessonHero hero={agenda.hero} now={agenda.now} />
              ))}
            {!searchOpen && <OverdueList periods={agenda.overdue} now={agenda.now} />}

            <section aria-labelledby="lessons-heading" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h2
                  id="lessons-heading"
                  className="text-[13px] font-semibold tracking-[1px] text-neutral-500"
                >
                  {isFinished ? "已結束的課" : "進行中的課"}
                  {tabsCount && ` · ${isFinished ? tabsCount.finished : tabsCount.inProgress}`}
                </h2>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab(isFinished ? "inProgress" : "finished")}
                    className="h-9 cursor-pointer px-2 text-[13px] text-neutral-500 hover:text-neutral-700"
                  >
                    {isFinished ? "進行中" : "已結束"}
                    {tabsCount && ` ${isFinished ? tabsCount.inProgress : tabsCount.finished}`}
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 px-2.5 text-[13px]"
                    onClick={() => router.push("/lessons/new")}
                  >
                    <Plus className="size-4" strokeWidth={2.2} />
                    新增
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <ActiveLessonRowsSkeleton />
              ) : lessons?.lessons.length === 0 ? (
                isFiltering ? (
                  <FilteredEmptyState list={list} />
                ) : (
                  <EmptyState
                    kind="inline"
                    title={isFinished ? "還沒有結束的課" : "沒有進行中的課"}
                  />
                )
              ) : isFinished ? (
                isFiltering ? (
                  <LessonTable lessons={lessons?.lessons ?? []} variant="finished" />
                ) : (
                  <FinishedLessons lessons={lessons?.lessons ?? []} />
                )
              ) : (
                <ActiveLessonRows lessons={lessons?.lessons ?? []} now={agenda.now} />
              )}
              <LoadMore list={list} />
            </section>
          </>
        )}
      </div>
    </>
  );
};

/* ───────────────────────── 桌面 ───────────────────────── */

const ExpandedLessons = ({ list }: { list: ListState }) => {
  const router = useRouter();
  const agenda = useLessonAgenda();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const {
    lessons,
    isLoading,
    sections,
    useGroupedView,
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
    newGroupName,
    setNewGroupName,
    createGroup,
    isCreatingGroup,
  } = list;

  const handleCreateGroup = async () => {
    if (await createGroup()) setCreateGroupOpen(false);
  };

  const showAgenda = agenda.isLoading || agenda.hero !== null || agenda.overdue.length > 0;

  return (
    <>
      <Navbar />
      <div className="px-8 py-6 w-full max-w-[1120px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-neutral-900">課程</h2>
          <Button onClick={() => router.push("/lessons/new")}>
            <Plus />
            新增課程
          </Button>
        </div>

        {showAgenda && (
          <div className="mb-6 grid grid-cols-2 items-start gap-5">
            {agenda.isLoading ? (
              <LessonHeroSkeleton />
            ) : agenda.hero ? (
              <LessonHero hero={agenda.hero} now={agenda.now} />
            ) : (
              <div />
            )}
            <OverdueList periods={agenda.overdue} now={agenda.now} />
          </div>
        )}

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

        {isLoading ? (
          <LessonTableSkeleton />
        ) : lessons?.lessons.length === 0 && !useGroupedView ? (
          isFiltering ? <FilteredEmptyState list={list} /> : <NoLessonsYet />
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
            <LoadMore list={list} />
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
    </>
  );
};

export default LessonsList;
