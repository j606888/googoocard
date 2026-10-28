"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, MessagesSquare, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { sorted, tierName } from "@/domains/curriculum/skillTree";
import { EMPTY_TALK, isOpen, talkMarks } from "@/domains/curriculum/talk";
import { useGetSkillTreeQuery, useGetTalkQuery } from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";
import AddSkillInline from "./AddSkillInline";
import ArchivedDrawer from "./ArchivedDrawer";
import DraftsDrawer from "./DraftsDrawer";
import EmptyTree from "./EmptyTree";
import SkillDrawer, { type SkillTab } from "./SkillDrawer";
import SkillNode from "./SkillNode";
import StructureDrawer from "./StructureDrawer";
import { CategoryMark } from "./categoryIcons";
import { useTalkContext } from "./useTalkContext";

type Filter = "all" | "open" | "fresh";

/** teach-what 的技能樹 logo（一棵分岔的樹）。 */
const TREE_LOGO = "M12 3v6M12 9l-6 5M12 9l6 5M6 14v5M18 14v5M12 9v10M10 3h4M4 19h4M10 19h4M16 19h4";

/** 金色的「討論中」數字。 */
const TalkCount = ({ n, label }: { n: number; label?: string }) => (
  <span
    aria-label={label}
    className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#F2B632] px-[5px] text-[11px] leading-none font-bold text-[#4A3305]"
  >
    {n}
  </span>
);
type Sheet = "structure" | "drafts" | "archived" | null;

const TreeSkeleton = () => (
  <div className="flex w-full flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6">
    <Skeleton className="h-7 w-40" />
    <div className="flex gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full" />
      ))}
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("flex flex-col gap-2", i === 1 && "opacity-50", i === 2 && "opacity-25")}>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ))}
    </div>
  </div>
);

/** /curriculum/[danceStyleId]：一個舞種的技能樹。?skill=<id>&tab=talk 直接打開某個技能的討論。 */
export default function SkillTreeView({ danceStyleId }: { danceStyleId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ctx = useTalkContext();
  const { data: tree, isLoading, isError } = useGetSkillTreeQuery({ danceStyleId });
  const { data: talk = EMPTY_TALK } = useGetTalkQuery({ danceStyleId });
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);

  const marks = useMemo(() => talkMarks(talk, ctx.me), [talk, ctx.me]);

  const skillParam = Number(searchParams.get("skill"));
  const tab: SkillTab = searchParams.get("tab") === "talk" ? "talk" : "content";
  const setQuery = (skill: number | null, nextTab: SkillTab = "content") => {
    const params = new URLSearchParams(searchParams.toString());
    if (skill) params.set("skill", String(skill));
    else params.delete("skill");
    if (skill && nextTab === "talk") params.set("tab", "talk");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (isLoading) return <TreeSkeleton />;
  if (isError || !tree) {
    return (
      <EmptyState
        title="找不到這個舞種"
        description="可能被刪掉了，或是在別的教室。"
        action={
          <Button asChild variant="secondary">
            <Link href="/curriculum">回到技能樹</Link>
          </Button>
        }
      />
    );
  }

  const style = danceStyleMeta(tree.danceStyle);
  const categories = sorted(tree.categories);
  const tiers = sorted(tree.tiers);
  const activeCategory = categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  const allSkills = [...tree.skills, ...tree.drafts, ...tree.archived];
  const openSkill = allSkills.find((s) => s.id === skillParam) ?? null;

  const live = [...tree.skills, ...tree.drafts];
  const openCount = live.filter((s) => isOpen(marks.get(s.id))).length;
  const freshCount = live.filter((s) => marks.get(s.id)?.fresh).length;
  const draftsFresh = tree.drafts.some((s) => marks.get(s.id)?.fresh);
  const inCategory = tree.skills.filter((s) => s.categoryId === activeCategory?.id);
  const matches = (id: number) =>
    filter === "all" || (filter === "open" ? isOpen(marks.get(id)) : !!marks.get(id)?.fresh);

  const header = (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button asChild variant="ghost" size="iconSm" aria-label="選別的舞種" className="-ml-1 text-neutral-500">
          <Link href="/curriculum">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-neutral-900 text-[#FFD166]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={TREE_LOGO} />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] leading-tight font-bold text-neutral-900">技能樹</h2>
          <p className="flex items-center gap-1.5 text-[11px] tracking-[.08em] text-neutral-500">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", style.dot)} />
            {tree.danceStyle.name}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:border-l lg:border-neutral-200 lg:pl-5">
        <Button asChild variant="secondary" size="sm" className="relative">
          <Link href={`/curriculum/${danceStyleId}/talk`}>
            <MessagesSquare className="size-4" />
            討論
            {openCount > 0 && <TalkCount n={openCount} />}
            {freshCount > 0 && (
              <span aria-label="有新留言" className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#2E6A8E]" />
            )}
          </Link>
        </Button>
        {ctx.canEdit && categories.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setSheet("structure")}>
            <Settings2 className="size-4" />
            分類與等級
          </Button>
        )}
        {tree.archived.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSheet("archived")}>
            <Archive className="size-4" />
            已封存 {tree.archived.length}
          </Button>
        )}
      </div>
    </header>
  );

  return (
    <div className="flex w-full flex-col gap-3 px-4 py-4 lg:px-8 lg:py-6">
      {header}

      {categories.length === 0 ? (
        <EmptyTree
          danceStyleId={danceStyleId}
          styleName={tree.danceStyle.name}
          canEdit={ctx.canEdit}
          draftCount={tree.drafts.length}
          onOpenDrafts={() => setSheet("drafts")}
        />
      ) : (
        <section aria-label="技能樹" className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div role="tablist" aria-label="分類" className="flex gap-1.5 overflow-x-auto border-b border-neutral-200 p-2.5">
            {categories.map((c) => {
              const skills = tree.skills.filter((s) => s.categoryId === c.id);
              const open = skills.filter((s) => isOpen(marks.get(s.id))).length;
              const on = c.id === activeCategory?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] pr-3 pl-1.5",
                    on ? "border-neutral-900 bg-[#F1EEFF]" : "border-neutral-200 bg-white hover:bg-neutral-50"
                  )}
                >
                  <CategoryMark category={c} size="sm" shape="square" />
                  <span className="text-sm font-bold whitespace-nowrap text-neutral-900">{c.name}</span>
                  <span className="text-xs whitespace-nowrap text-neutral-500 tabular-nums">{skills.length} 招</span>
                  {open > 0 && <TalkCount n={open} label={`${open} 個技能討論中`} />}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto px-3.5 pt-3 lg:flex-wrap">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              全部
            </FilterChip>
            <FilterChip active={filter === "open"} onClick={() => setFilter("open")} count={openCount}>
              討論中
            </FilterChip>
            <FilterChip active={filter === "fresh"} onClick={() => setFilter("fresh")} count={freshCount}>
              有新留言
            </FilterChip>
            <button
              type="button"
              onClick={() => setSheet("drafts")}
              className="relative ml-auto inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full border border-dashed border-[#C9B26A] bg-[#FBF1D6] px-3 text-[12.5px] font-bold text-[#6B4F08]"
            >
              待定區{tree.drafts.length > 0 && ` ${tree.drafts.length}`}
              {draftsFresh && (
                <span aria-label="有新留言" className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#2E6A8E]" />
              )}
            </button>
          </div>

          {/* Same tree on both sizes: stacked tiers on phones, side-by-side columns on desktop. */}
          <div role="tabpanel" aria-label={activeCategory?.name} className="grid lg:auto-cols-[minmax(260px,1fr)] lg:grid-flow-col lg:overflow-x-auto">
            {tiers.map((tier, i) => {
              const skills = inCategory.filter((s) => s.tierId === tier.id);
              return (
                <div
                  key={tier.id}
                  className="min-w-0 border-neutral-200 p-3.5 not-first:border-t lg:not-first:border-t-0 lg:not-first:border-l"
                >
                  <h3 className="mb-2.5 flex items-center gap-2">
                    <span className="rounded-md bg-neutral-900 px-2 py-[5px] text-[13px] leading-none font-black text-white">
                      {tierName(i)}
                    </span>
                    {tier.label && <span className="text-xs text-neutral-500">{tier.label}</span>}
                    <span className="ml-auto text-xs font-semibold text-neutral-900 tabular-nums">{skills.length} 個技能</span>
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1">
                    {skills.map((skill) => (
                      <SkillNode
                        key={skill.id}
                        skill={skill}
                        category={activeCategory}
                        mark={marks.get(skill.id)}
                        dimmed={!matches(skill.id)}
                        selected={skill.id === openSkill?.id}
                        onOpen={() => setQuery(skill.id)}
                      />
                    ))}
                    {ctx.canEdit && activeCategory && (
                      <AddSkillInline danceStyleId={danceStyleId} categoryId={activeCategory.id} tierId={tier.id} />
                    )}
                  </div>
                  {!ctx.canEdit && skills.length === 0 && (
                    <p className="mt-2 text-xs text-neutral-500">這一轉還沒有這個分類的技能</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SkillDrawer
        skill={openSkill}
        tree={tree}
        talk={talk}
        ctx={ctx}
        tab={tab}
        onTab={(next) => openSkill && setQuery(openSkill.id, next)}
        onClose={() => setQuery(null)}
      />
      {tree.categories.length > 0 && (
        <StructureDrawer open={sheet === "structure"} tree={tree} onClose={() => setSheet(null)} />
      )}
      <DraftsDrawer
        open={sheet === "drafts"}
        tree={tree}
        marks={marks}
        canEdit={ctx.canEdit}
        onOpenSkill={(id) => setQuery(id)}
        onClose={() => setSheet(null)}
      />
      <ArchivedDrawer
        open={sheet === "archived"}
        tree={tree}
        canEdit={ctx.canEdit}
        onOpenSkill={(id) => setQuery(id)}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
