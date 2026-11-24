"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Search, Sparkles } from "lucide-react";
import AgendaList, { OverdueNotice } from "./AgendaList";
import SeriesList from "./SeriesList";
import { useLessonsList } from "./useLessonsList";
import { useLessonAgenda } from "./useLessonAgenda";
import { useLessonScope } from "./useLessonScope";
import { unorganizedLessonCount } from "./seriesSuggest";
import { sectionByLocation } from "./lessonSeries";
import Drawer from "@/components/Drawer";
import Menu from "@/components/Menu";
import EmptyState from "@/components/EmptyState";
import Field from "@/components/Field";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/features/Navbar";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";

/** Select 的值不能是 null，用 0 代表「全部」。 */
const ALL = 0;

/**
 * 課程列表（去框線改版 v2，~/.claude/plans/quiet-redesign.md §3.2）。
 * - 還沒點名的課：頁首下一條琥珀提醒，不限天數（`OverdueNotice`）。
 * - 「接下來 7 天」：上課中＋今天以後的課。
 * - 「所有課程」：依課種排，一個課種一列，點了直接進正在開的那一期。
 * 兩區之間是 8px 淺灰帶，不是框。
 *
 * 最上面的「我的課／全部」與分部篩整頁，記在裝置上（`useLessonScope`）。
 * 只掛一棵樹（docs/ui-responsive.md）：手機與桌面差在搜尋的位置與欄位多寡。
 */
const LessonsList = () => {
  const router = useRouter();
  const isExpanded = useSizeClass() === "expanded";
  const { data: classrooms } = useGetClassroomsQuery();
  const [scope, setScope] = useLessonScope(classrooms?.currentClassroomId ?? undefined);
  // 這次打開後親手點過「我的課」就照做；否則 7 天內沒有自己的課時先看全部。
  const [mineChosen, setMineChosen] = useState(false);
  const agenda = useLessonAgenda({ ...scope, fallbackToAll: !mineChosen });
  const effectiveScope = useMemo(
    () => ({ ...scope, mine: agenda.mine }),
    [scope, agenda.mine]
  );
  const list = useLessonsList(effectiveScope, agenda.myTeacherId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const overdueRows = agenda.rows.filter((row) => row.state === "overdue");
  const upcomingRows = agenda.rows.filter((row) => row.state !== "overdue");

  const unorganized = useMemo(
    () => unorganizedLessonCount(list.allLessons, list.groups),
    [list.allLessons, list.groups]
  );

  const { byId } = useDanceStyles();
  const styleOptions = [...byId.values()].filter((style) =>
    list.availableDanceStyleIds.includes(style.id)
  );
  const { all: allLocations } = useLocations();
  const locationOptions = allLocations.filter((l) => list.availableLocationIds.includes(l.id));

  const closeSearch = () => {
    list.setSearch("");
    setSearchOpen(false);
  };
  const handleCreateGroup = async () => {
    if (await list.createGroup()) setCreateGroupOpen(false);
  };

  const searchField = (
    <div className="relative min-w-0 flex-1 lg:order-last lg:ml-auto lg:max-w-[260px]">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        autoFocus={!isExpanded}
        value={list.search}
        onChange={(e) => list.setSearch(e.target.value)}
        placeholder="搜尋課程或老師"
        aria-label="搜尋課程或老師"
        className="h-11 w-full rounded-lg bg-band pr-3 pl-10 text-[15px] text-ink outline-none placeholder:text-ink-3 focus-visible:ring-[3px] focus-visible:ring-primary-300 lg:text-sm"
      />
    </div>
  );

  // 我的課／全部只有帳號連到老師頁上的人時才有意義。
  const scopeBar = (
    <>
      {agenda.myTeacherId !== null && (
        <SegmentedTabs
          ariaLabel="課程範圍"
          value={agenda.mine ? "mine" : "all"}
          onChange={(value) => {
            setMineChosen(value === "mine");
            setScope({ mine: value === "mine" });
          }}
          options={[
            { value: "mine", label: "我的課" },
            { value: "all", label: "全部" },
          ]}
        />
      )}
      {locationOptions.length > 1 && (
        <Select
          size="plain"
          aria-label="分部"
          className="w-auto"
          value={scope.locationId ?? ALL}
          onChange={(value) => setScope({ locationId: value === ALL ? null : value })}
          options={[
            { value: ALL, label: "所有分部" },
            ...locationOptions.map((l) => ({ value: l.id, label: l.name })),
          ]}
        />
      )}
    </>
  );

  const newLessonButton = (
    <Button
      onClick={() => router.push("/lessons/new")}
      variant={isExpanded ? "primary" : "text"}
      className={isExpanded ? "" : "gap-1 px-2"}
    >
      <Plus />
      {isExpanded ? "新增課程" : "新增"}
    </Button>
  );

  // 不常用的課種動作收進「⋯」，頁面只留一顆主按鈕。
  const moreMenu = (
    <>
      <Button
        ref={moreRef}
        variant="ghost"
        size="icon"
        aria-label="更多：新增課種、翻新精靈"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen(!moreOpen)}
        className="text-ink-2"
      >
        <MoreHorizontal className="size-5" />
      </Button>
      <Menu
        open={moreOpen}
        anchorEl={moreRef.current}
        onClose={() => setMoreOpen(false)}
        placement="bottom-end"
        className="z-50 flex w-44 flex-col rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)]"
      >
        <button
          type="button"
          onClick={() => {
            setMoreOpen(false);
            setCreateGroupOpen(true);
          }}
          className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-primary-50"
        >
          <Plus className="size-4" />
          新增課種
        </button>
        <button
          type="button"
          onClick={() => router.push("/lessons/organize")}
          className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-primary-50"
        >
          <Sparkles className="size-4" />
          翻新精靈
        </button>
      </Menu>
    </>
  );

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
            className="text-neutral-700 lg:hidden"
          >
            <Search className="size-5.5" />
          </Button>
        }
      />
      <div className="flex w-full flex-col gap-6 px-5 pt-3 pb-10 lg:max-w-[1280px] lg:px-12 lg:pt-8">
        <div className="flex flex-wrap items-center gap-2.5 lg:gap-4">
          <h1 className="mr-2 hidden text-[26px] font-semibold text-ink lg:block">課程</h1>
          {scopeBar}
          <span className="ml-auto flex items-center gap-1 lg:gap-2">
            {moreMenu}
            {newLessonButton}
          </span>
        </div>

        {list.hasNoLessons ? (
          <EmptyState
            pose="sit"
            title="還沒有課程"
            description="建立課程就可以開始上課了！"
            action={
              <Button onClick={() => router.push("/lessons/new")}>
                <Plus />
                新增課程
              </Button>
            }
          />
        ) : (
          <>
            <OverdueNotice rows={overdueRows} />
            <AgendaList
              rows={upcomingRows}
              now={agenda.now}
              isLoading={agenda.isLoading}
              hiddenCount={agenda.hiddenCount}
              onShowAll={() => setScope({ mine: false, locationId: null })}
            />

            <div aria-hidden="true" className="-mx-5 h-2 bg-band lg:-mx-12" />

            <section aria-labelledby="series-heading" className="flex flex-col gap-3">
              {unorganized > 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/lessons/organize")}
                  className="flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 text-left hover:bg-primary-100"
                >
                  <Sparkles aria-hidden="true" className="size-5 shrink-0 text-primary-700" />
                  <span className="min-w-0 flex-1 text-sm text-neutral-800">
                    有 {unorganized} 門舊課還沒歸到課種，用翻新精靈一次整理課種、分部和小幫手
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary-700">開始</span>
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2.5 lg:gap-4">
                <h2 id="series-heading" className="mr-1 w-full text-[17px] font-semibold text-ink lg:w-auto">
                  所有課程
                </h2>
                <SegmentedTabs
                  ariaLabel="課程狀態"
                  value={list.tab}
                  onChange={list.setTab}
                  options={[
                    { value: "active", label: "開課中", hint: list.counts.active },
                    { value: "inactive", label: "沒在開", hint: list.counts.inactive },
                  ]}
                />
                {isExpanded ? (
                  searchField
                ) : (
                  searchOpen && (
                    <div className="flex w-full items-center gap-2">
                      {searchField}
                      <Button variant="ghost" size="sm" onClick={closeSearch}>
                        取消
                      </Button>
                    </div>
                  )
                )}
                {styleOptions.length > 1 && (
                  <Select
                    size="plain"
                    aria-label="舞種"
                    className="w-auto"
                    value={list.danceStyleId ?? ALL}
                    onChange={(value) => list.setDanceStyleId(value === ALL ? null : value)}
                    options={[
                      { value: ALL, label: "所有舞種" },
                      ...styleOptions.map((style) => ({ value: style.id, label: style.name })),
                    ]}
                  />
                )}
              </div>

              {list.isLoading ? (
                <div aria-busy="true" className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full rounded-2xl" />
                  <Skeleton className="h-14 w-full rounded-2xl opacity-60" />
                  <Skeleton className="h-14 w-full rounded-2xl opacity-30" />
                </div>
              ) : list.series.length === 0 ? (
                <EmptyState
                  kind={list.isFiltering ? "filtered" : "inline"}
                  title={
                    list.isFiltering
                      ? "沒有符合的課程"
                      : list.tab === "active"
                        ? "沒有開課中的課"
                        : "沒有停開的課"
                  }
                  action={
                    list.isFiltering ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          list.setSearch("");
                          list.setDanceStyleId(null);
                        }}
                      >
                        清除篩選
                      </Button>
                    ) : list.tab === "active" && list.counts.inactive > 0 ? (
                      <Button variant="secondary" size="sm" onClick={() => list.setTab("inactive")}>
                        看沒在開的 {list.counts.inactive} 門
                      </Button>
                    ) : list.tab === "active" ? (
                      <Button variant="secondary" size="sm" onClick={() => router.push("/lessons/new")}>
                        <Plus />
                        新增課程
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <SeriesList
                  series={list.series}
                  now={agenda.now}
                  sections={
                    list.tab === "active" && scope.locationId === null && allLocations.length > 1
                      ? sectionByLocation(list.series, allLocations)
                      : undefined
                  }
                />
              )}

            </section>
          </>
        )}

        <Drawer
          title="新增課種"
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          onSubmit={handleCreateGroup}
          isLoading={list.isCreatingGroup}
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
              placeholder="例如：Bachata Level 1"
              value={list.newGroupName}
              onChange={(e) => list.setNewGroupName(e.target.value)}
            />
          </form>
        </Drawer>
      </div>
    </>
  );
};

export default LessonsList;
