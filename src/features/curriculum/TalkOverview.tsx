"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import { EMPTY_TALK, isOpen, talkMarks } from "@/domains/curriculum/talk";
import { useGetSkillTreeQuery, useGetTalkQuery } from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";
import { ago, placeText } from "./format";
import { useTalkContext } from "./useTalkContext";

type Filter = "all" | "open" | "fresh" | "concluded";

/** /curriculum/[danceStyleId]/talk：這個舞種所有有留言的技能。未讀排前面，再照最新留言。 */
export default function TalkOverview({ danceStyleId }: { danceStyleId: number }) {
  const ctx = useTalkContext();
  const { data: tree, isLoading: treeLoading } = useGetSkillTreeQuery({ danceStyleId });
  const { data: talk = EMPTY_TALK, isLoading: talkLoading } = useGetTalkQuery(
    { danceStyleId },
    { refetchOnMountOrArgChange: true }
  );
  const [filter, setFilter] = useState<Filter>("all");
  const marks = useMemo(() => talkMarks(talk, ctx.me), [talk, ctx.me]);

  const rows = useMemo(() => {
    if (!tree) return [];
    const skills = [...tree.skills, ...tree.drafts, ...tree.archived];
    return skills
      .filter((s) => marks.has(s.id))
      .map((skill) => {
        const comments = talk.comments.filter((c) => c.skillId === skill.id);
        const latest = comments[comments.length - 1];
        const conclusion = comments.find((c) => c.conclusion);
        return { skill, mark: marks.get(skill.id)!, latest, shown: conclusion ?? latest };
      })
      .sort((a, b) => Number(b.mark.fresh) - Number(a.mark.fresh) || b.latest.createdAt.localeCompare(a.latest.createdAt));
  }, [tree, talk, marks]);

  const counts = {
    all: rows.length,
    open: rows.filter((r) => isOpen(r.mark)).length,
    fresh: rows.filter((r) => r.mark.fresh).length,
    concluded: rows.filter((r) => r.mark.concluded).length,
  };
  const shown = rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "open" ? isOpen(r.mark) : filter === "fresh" ? r.mark.fresh : r.mark.concluded)
  );
  const loading = treeLoading || talkLoading;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-4 lg:max-w-[880px] lg:px-8 lg:py-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="iconSm" aria-label="回到技能樹" className="-ml-2 text-neutral-500">
          <Link href={`/curriculum/${danceStyleId}`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h2 className="truncate text-2xl font-bold text-neutral-900">
          {tree ? `${tree.danceStyle.name} 的討論` : "討論"}
        </h2>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {(
          [
            ["all", "全部"],
            ["open", "討論中"],
            ["fresh", "有新留言"],
            ["concluded", "有結論"],
          ] as const
        ).map(([value, label]) => (
          <FilterChip key={value} active={filter === value} onClick={() => setFilter(value)} count={counts[value]}>
            {label}
          </FilterChip>
        ))}
      </div>

      {loading && (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn("rounded-2xl border border-neutral-200 bg-white p-4", i === 1 && "opacity-50", i === 2 && "opacity-25")}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3.5 w-3/4" />
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="還沒有人留言"
          description="在技能樹上點一個技能，切到「討論」就能開始。"
          action={
            <Button asChild variant="secondary">
              <Link href={`/curriculum/${danceStyleId}`}>回到技能樹</Link>
            </Button>
          }
        />
      )}
      {!loading && rows.length > 0 && shown.length === 0 && (
        <EmptyState
          kind="filtered"
          title="沒有符合的討論"
          action={
            <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
              看全部
            </Button>
          }
        />
      )}

      <ul className="flex flex-col gap-2">
        {tree &&
          shown.map(({ skill, mark, shown: comment }) => (
            <li key={skill.id}>
              <Link
                href={`/curriculum/${danceStyleId}?skill=${skill.id}&tab=talk`}
                className="flex flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-300"
              >
                <div className="flex items-center gap-2">
                  {mark.fresh && <span aria-label="有新留言" className="size-2 shrink-0 rounded-full bg-danger-600" />}
                  <span className="truncate font-bold text-neutral-900">{skill.name}</span>
                  <span className="truncate text-xs text-neutral-500">{placeText(skill, tree.categories, tree.tiers)}</span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-500">
                    <MessageCircle className="size-3.5" />
                    {mark.count}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-neutral-700">
                  {comment.conclusion && (
                    <span className="mr-1 inline-flex items-center gap-0.5 font-semibold text-primary-900">
                      <Check className="size-3.5" />
                      結論
                    </span>
                  )}
                  {comment.text}
                </p>
                <p className="text-xs text-neutral-500">
                  {comment.authorId === ctx.me ? "你" : comment.author} · {ago(comment.createdAt)}
                </p>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
