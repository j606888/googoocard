"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { useRestoreSkillMutation, type SkillTree } from "@/store/slices/curriculum";
import { placeText } from "./format";
import Panel from "./Panel";

/** 已封存：從樹上移除的技能，留言與紀錄都還在，可以還原。 */
export default function ArchivedDrawer({
  open,
  tree,
  canEdit,
  onOpenSkill,
  onClose,
}: {
  open: boolean;
  tree: SkillTree;
  canEdit: boolean;
  onOpenSkill: (id: number) => void;
  onClose: () => void;
}) {
  const [restore, { isLoading, originalArgs }] = useRestoreSkillMutation();

  const onRestore = async (id: number, name: string) => {
    try {
      await restore({ id }).unwrap();
      toast.success(`已還原「${name}」`);
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      toast.error(code === "SKILL_NAME_TAKEN" ? "樹上已經有同名的技能了" : "沒有成功，請再試一次");
    }
  };

  return (
    <Panel open={open} title={`已封存 ${tree.archived.length}`} subtitle={tree.danceStyle.name} onClose={onClose}>
      {tree.archived.length === 0 ? (
        <EmptyState kind="inline" title="沒有封存的技能" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {tree.archived.map((skill) => {
            const category = tree.categories.find((c) => c.id === skill.categoryId);
            return (
              <li key={skill.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpenSkill(skill.id)}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
                >
                  <span className="truncate font-medium text-neutral-900">{skill.name}</span>
                  <span className="text-xs text-neutral-500">
                    {category && skill.tierId
                      ? `原本在 ${placeText({ ...skill, archivedAt: null }, tree.categories, tree.tiers)}`
                      : "還原後會回到待定區"}
                  </span>
                </button>
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isLoading && originalArgs?.id === skill.id}
                    onClick={() => onRestore(skill.id, skill.name)}
                  >
                    還原
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
