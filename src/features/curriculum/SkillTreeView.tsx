"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, MessagesSquare, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import SegmentedTabs from "@/components/SegmentedTabs";
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
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Button asChild variant="ghost" size="iconSm" aria-label="選別的舞種" className="-ml-2 text-neutral-500">
          <Link href="/curriculum">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", style.dot)} />
        <h2 className="truncate text-2xl font-bold text-neutral-900">{tree.danceStyle.name}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm" className="relative">
          <Link href={`/curriculum/${danceStyleId}/talk`}>
            <MessagesSquare className="size-4" />
            討論
            {openCount > 0 && <span className="text-warning-950">{openCount}</span>}
            {freshCount > 0 && (
              <span aria-label="有新留言" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-danger-600" />
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
    <div className="flex w-full flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6">
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
        <>
          <div className="-mx-4 overflow-x-auto overflow-y-hidden border-b border-neutral-200 px-4 lg:mx-0 lg:px-0">
            <SegmentedTabs
              variant="underline"
              ariaLabel="分類"
              value={String(activeCategory?.id ?? "")}
              onChange={(v) => setCategoryId(Number(v))}
              className="w-max"
              options={categories.map((c) => {
                const skills = tree.skills.filter((s) => s.categoryId === c.id);
                const open = skills.filter((s) => isOpen(marks.get(s.id))).length;
                return {
                  value: String(c.id),
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <CategoryMark category={c} size="sm" />
                      {c.name}
                    </span>
                  ),
                  hint: (
                    <>
                      {skills.length}
                      {open > 0 && <span className="ml-1 font-semibold text-warning-950">· {open} 討論中</span>}
                    </>
                  ),
                };
              })}
            />
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              全部
            </FilterChip>
            <FilterChip active={filter === "open"} onClick={() => setFilter("open")} count={openCount}>
              討論中
            </FilterChip>
            <FilterChip active={filter === "fresh"} onClick={() => setFilter("fresh")} count={freshCount}>
              有新留言
            </FilterChip>
            <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-neutral-200" />
            <FilterChip active={false} onClick={() => setSheet("drafts")} count={tree.drafts.length} alert={draftsFresh}>
              待定區
            </FilterChip>
          </div>

          {/* Same tree on both sizes: stacked tiers on phones, side-by-side columns on desktop. */}
          <div className="grid gap-5 lg:auto-cols-[minmax(220px,1fr)] lg:grid-flow-col lg:gap-4 lg:overflow-x-auto lg:pb-2">
            {tiers.map((tier, i) => {
              const skills = inCategory.filter((s) => s.tierId === tier.id);
              return (
                <section key={tier.id} className="flex min-w-0 flex-col gap-2 lg:rounded-2xl lg:bg-neutral-50 lg:p-3">
                  <h3 className="flex items-baseline gap-1.5 px-1">
                    <span className="font-bold text-neutral-900">{tierName(i)}</span>
                    {tier.label && <span className="text-sm text-neutral-600">{tier.label}</span>}
                    <span className="ml-auto text-xs text-neutral-500">{skills.length}</span>
                  </h3>
                  {skills.map((skill) => (
                    <SkillNode
                      key={skill.id}
                      skill={skill}
                      category={activeCategory}
                      mark={marks.get(skill.id)}
                      dimmed={!matches(skill.id)}
                      onOpen={() => setQuery(skill.id)}
                    />
                  ))}
                  {ctx.canEdit && activeCategory && (
                    <AddSkillInline danceStyleId={danceStyleId} categoryId={activeCategory.id} tierId={tier.id} />
                  )}
                  {!ctx.canEdit && skills.length === 0 && (
                    <p className="px-1 text-[13px] text-neutral-500">還沒有技能</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
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
