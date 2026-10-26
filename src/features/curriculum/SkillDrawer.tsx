"use client";

import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import SegmentedTabs from "@/components/SegmentedTabs";
import { Button } from "@/components/ui/button";
import type { Talk } from "@/domains/curriculum/talk";
import type { Skill, SkillTree } from "@/store/slices/curriculum";
import { CategoryMark } from "./categoryIcons";
import { placeText } from "./format";
import SkillContent from "./SkillContent";
import TalkBoard from "./talk/TalkBoard";
import type { TalkContext } from "./useTalkContext";

export type SkillTab = "content" | "talk";

/** 點技能打開：桌面置中彈窗、手機底部面板，「內容」與「討論」兩個分頁。 */
export default function SkillDrawer({
  skill,
  tree,
  talk,
  ctx,
  tab,
  onTab,
  onClose,
}: {
  skill: Skill | null;
  tree: SkillTree;
  talk: Talk | undefined;
  ctx: TalkContext;
  tab: SkillTab;
  onTab: (tab: SkillTab) => void;
  onClose: () => void;
}) {
  const category = tree.categories.find((c) => c.id === skill?.categoryId) ?? null;
  const commentCount = skill ? (talk?.comments.filter((c) => c.skillId === skill.id).length ?? 0) : 0;

  return (
    <ResponsiveDialog
      open={!!skill}
      onClose={onClose}
      className="h-[85vh] p-0 lg:h-[80vh] lg:max-w-[600px]"
    >
      {skill && (
        <>
          <div className="flex items-start gap-3 px-5 pt-5">
            <CategoryMark category={category} />
            <div className="flex min-w-0 flex-1 flex-col">
              <ResponsiveDialogTitle className="truncate text-lg font-bold text-neutral-900">
                {skill.name}
              </ResponsiveDialogTitle>
              <p className="text-[13px] text-neutral-500">{placeText(skill, tree.categories, tree.tiers)}</p>
            </div>
            <Button variant="ghost" size="iconSm" className="-mr-1 text-neutral-500" onClick={onClose} aria-label="關閉">
              <X className="size-5" />
            </Button>
          </div>
          <SegmentedTabs
            variant="underline"
            ariaLabel="技能分頁"
            value={tab}
            onChange={onTab}
            options={[
              { value: "content", label: "內容" },
              { value: "talk", label: "討論", hint: commentCount || undefined },
            ]}
            className="border-b border-neutral-200 px-3"
          />
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "content" ? (
              <SkillContent
                key={skill.id}
                skill={skill}
                tree={tree}
                canEdit={ctx.canEdit}
                commentCount={commentCount}
                onRemoved={onClose}
              />
            ) : (
              <TalkBoard
                key={skill.id}
                ctx={ctx}
                danceStyleId={tree.danceStyle.id}
                skillId={skill.id}
                comments={talk?.comments ?? []}
              />
            )}
          </div>
        </>
      )}
    </ResponsiveDialog>
  );
}
