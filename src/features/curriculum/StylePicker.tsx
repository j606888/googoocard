"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { useCan } from "@/hooks/useCan";
import { useGetCurriculumStylesQuery } from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";

const CardSkeleton = ({ fade = "" }: { fade?: string }) => (
  <li className={cn("flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5", fade)}>
    <Skeleton className="h-5 w-28" />
    <Skeleton className="h-3.5 w-40" />
  </li>
);

/** /curriculum：每個舞種一張卡（技能數、待定、討論中、紅點）。 */
export default function StylePicker() {
  const canEdit = useCan("curriculum.edit");
  const { data, isLoading } = useGetCurriculumStylesQuery(undefined, { refetchOnMountOrArgChange: true });

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-4 lg:max-w-[960px] lg:px-8 lg:py-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-neutral-900">技能樹</h2>
        <p className="text-sm text-neutral-600">每個舞種一棵樹，把想教的東西排成分類 × 等級，每個技能都能留言討論。</p>
      </div>

      {!isLoading && data?.length === 0 && (
        <EmptyState
          title="還沒有舞種"
          description="技能樹是跟著舞種長的，先到舞種頁新增一個。"
          action={
            <Button asChild>
              <Link href="/dance-styles">去新增舞種</Link>
            </Button>
          }
        />
      )}

      <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {isLoading && (
          <>
            <CardSkeleton />
            <CardSkeleton fade="opacity-50" />
            <CardSkeleton fade="opacity-25" />
          </>
        )}
        {data?.map(({ danceStyle, hasTree, skillCount, draftCount, openCount, freshCount }) => {
          const meta = danceStyleMeta(danceStyle);
          return (
            <li key={danceStyle.id}>
              <Link
                href={`/curriculum/${danceStyle.id}`}
                className="flex h-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 transition-colors hover:border-primary-300"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn("size-3 rounded-full", meta.dot)} />
                  <span className="flex-1 truncate text-lg font-bold text-neutral-900">{danceStyle.name}</span>
                  {freshCount > 0 && (
                    <span aria-label={`${freshCount} 個技能有新留言`} className="size-2.5 rounded-full bg-danger-600" />
                  )}
                  <ChevronRight className="size-4 text-neutral-400" />
                </div>
                {hasTree ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-600">
                    <span>{skillCount} 個技能</span>
                    {draftCount > 0 && <span>· 待定 {draftCount}</span>}
                    {openCount > 0 && <StatusTag tone="warning">{openCount} 討論中</StatusTag>}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    還沒有技能樹{canEdit ? "，點進去建立" : ""}
                    {draftCount > 0 && `（待定 ${draftCount}）`}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
