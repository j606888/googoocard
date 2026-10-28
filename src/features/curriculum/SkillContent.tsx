"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import FilterChip from "@/components/FilterChip";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHANGE_WORD,
  SKILL_DESCRIPTION_MAX,
  SKILL_FULL_NAME_MAX,
  SKILL_NAME_MAX,
  sorted,
  tierName,
} from "@/domains/curriculum/skillTree";
import {
  useGetSkillHistoryQuery,
  useRemoveSkillMutation,
  useRestoreSkillMutation,
  useUpdateSkillMutation,
  type Skill,
  type SkillTree,
} from "@/store/slices/curriculum";
import { ago } from "./format";

const errorText = (e: unknown, fallback: string) => {
  const code = (e as { data?: { code?: string } })?.data?.code;
  if (code === "SKILL_NAME_TAKEN") return "已經有同名的技能了";
  if (code === "SKILL_ARCHIVED") return "先還原才能改";
  return fallback;
};

/** 技能抽屜的「內容」：名稱、全名、描述（離開欄位就存）、分類、等級、修改紀錄。移除／還原在 `SkillActions`。 */
export default function SkillContent({ skill, tree, canEdit }: { skill: Skill; tree: SkillTree; canEdit: boolean }) {
  const editable = canEdit && !skill.archivedAt;
  const isDraft = skill.categoryId === null && !skill.archivedAt;
  const [update] = useUpdateSkillMutation();
  const [showAll, setShowAll] = useState(false);
  const { data: history, isLoading: historyLoading } = useGetSkillHistoryQuery({ id: skill.id });
  const tiers = sorted(tree.tiers);
  const categories = sorted(tree.categories);

  const save = async (patch: Parameters<typeof update>[0], fallback = "沒有存到，請再試一次") => {
    try {
      await update(patch).unwrap();
    } catch (e) {
      toast.error(errorText(e, fallback));
    }
  };

  const saveText = (field: "name" | "fullName" | "description", value: string) => {
    const trimmed = value.trim();
    if (trimmed === skill[field]) return;
    if (field === "name" && !trimmed) return;
    save({ id: skill.id, [field]: trimmed });
  };

  const textField = (
    field: "name" | "fullName" | "description",
    label: string,
    max: number,
    hint?: string
  ) => {
    const id = `skill-${skill.id}-${field}`;
    if (!editable) {
      if (!skill[field] && field !== "name") return null;
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-500">{label}</span>
          <p className="whitespace-pre-wrap text-[15px] text-neutral-900">{skill[field]}</p>
        </div>
      );
    }
    // key on the saved value so a refetch (or a refused rename) resets the box
    const key = `${id}-${skill[field]}`;
    const common = {
      id,
      defaultValue: skill[field],
      maxLength: max,
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => saveText(field, e.target.value),
    };
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id} hint={hint}>
          {label}
        </FieldLabel>
        {field === "description" ? (
          <textarea key={key} {...common} rows={3} className={`${fieldControlClass()} py-2.5`} />
        ) : (
          <input key={key} {...common} className={`${fieldControlClass()} h-12`} />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {textField("name", "名稱", SKILL_NAME_MAX)}
      {textField("fullName", "全名", SKILL_FULL_NAME_MAX, "（選填）")}
      {textField("description", "描述", SKILL_DESCRIPTION_MAX, "（選填）")}

      {!skill.archivedAt && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">分類</span>
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <FilterChip active onClick={() => {}} size="sm">
                  還沒放進樹
                </FilterChip>
              )}
              {categories.map((c) => (
                <FilterChip
                  key={c.id}
                  size="sm"
                  active={c.id === skill.categoryId}
                  onClick={() =>
                    editable &&
                    c.id !== skill.categoryId &&
                    // Placing a 待定 card needs a tier; take its own or the first.
                    save({ id: skill.id, categoryId: c.id, tierId: skill.tierId ?? tiers[0]?.id })
                  }
                  className={editable ? "" : "pointer-events-none"}
                >
                  {c.name}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">等級</span>
            <div className="flex flex-wrap gap-2">
              {tiers.map((t, i) => (
                <FilterChip
                  key={t.id}
                  size="sm"
                  active={t.id === skill.tierId}
                  onClick={() => editable && t.id !== skill.tierId && save({ id: skill.id, tierId: t.id })}
                  className={editable ? "" : "pointer-events-none"}
                >
                  {tierName(i)}
                  {t.label && <span className="opacity-70">{t.label}</span>}
                </FilterChip>
              ))}
            </div>
          </div>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-neutral-900">修改紀錄</h3>
        {historyLoading && <Skeleton className="h-4 w-48" />}
        <ol className="flex flex-col gap-1.5">
          {(showAll ? history : history?.slice(0, 5))?.map((change) => (
            <li key={change.id} className="text-[13px] leading-relaxed text-neutral-600">
              <span className="font-medium text-neutral-900">{change.actor?.name ?? "有人"}</span>{" "}
              {CHANGE_WORD[change.kind] ?? change.kind}
              {change.fromValue && change.toValue && `：${change.fromValue} → ${change.toValue}`}
              {!change.fromValue && change.toValue && `：${change.toValue}`}
              <span className="text-neutral-500"> · {ago(change.createdAt)}</span>
            </li>
          ))}
        </ol>
        {!showAll && (history?.length ?? 0) > 5 && (
          <Button variant="link" size="sm" className="w-fit" onClick={() => setShowAll(true)}>
            看全部 {history!.length} 筆
          </Button>
        )}
      </section>

    </div>
  );
}

/**
 * 技能抽屜「內容」分頁的底部按鈕列：從樹上移除（待定卡是刪除）、封存的就還原。
 * 只給能編輯的人。
 */
export function SkillActions({
  skill,
  commentCount,
  onRemoved,
}: {
  skill: Skill;
  commentCount: number;
  onRemoved: () => void;
}) {
  const isDraft = skill.categoryId === null && !skill.archivedAt;
  const [remove, { isLoading: removing }] = useRemoveSkillMutation();
  const [restore, { isLoading: restoring }] = useRestoreSkillMutation();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const onRemove = async () => {
    try {
      const { deleted } = await remove({ id: skill.id }).unwrap();
      toast.success(deleted ? `已刪除「${skill.name}」` : `已把「${skill.name}」從樹上移除`);
      setConfirmRemove(false);
      onRemoved();
    } catch {
      toast.error("沒有成功，請再試一次");
    }
  };

  const onRestore = async () => {
    try {
      await restore({ id: skill.id }).unwrap();
      toast.success(`已還原「${skill.name}」`);
    } catch (e) {
      toast.error(errorText(e, "沒有成功，請再試一次"));
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      {skill.archivedAt ? (
        <Button variant="secondary" onClick={onRestore} isLoading={restoring}>
          <ArchiveRestore />
          還原
        </Button>
      ) : (
        <Button variant="dangerSecondary" onClick={() => setConfirmRemove(true)}>
          <Trash2 />
          {isDraft ? "刪除這張待定卡" : "從樹上移除"}
        </Button>
      )}
      <span className="text-[13px] text-neutral-500">
        {skill.archivedAt ? "還原之後才能改" : "改完離開欄位就會自動存"}
      </span>

      <ConfirmDialog
        open={confirmRemove}
        title={isDraft ? `刪除「${skill.name}」？` : `把「${skill.name}」從樹上移除？`}
        message={
          isDraft
            ? commentCount > 0
              ? `這張待定卡有 ${commentCount} 則留言，會一起刪掉，救不回來。`
              : "待定卡刪掉就沒了。"
            : "會移到「已封存」，留言和修改紀錄都留著，隨時可以還原。"
        }
        confirmLabel={isDraft ? "刪除" : "移除"}
        variant="danger"
        isLoading={removing}
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
