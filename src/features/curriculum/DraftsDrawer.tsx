"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { MAX_DRAFT_PASTE, SKILL_NAME_MAX, draftNames, sorted, tierName } from "@/domains/curriculum/skillTree";
import type { TalkMark } from "@/domains/curriculum/talk";
import { useAddDraftsMutation, usePlaceDraftsMutation, type SkillTree } from "@/store/slices/curriculum";
import { tierText } from "./format";
import Panel from "./Panel";

/**
 * 待定區：還沒想好放哪的技能先丟這裡。一次可以貼多行；勾選幾張，選分類與等級，
 * 一起放進樹。點卡片打開技能抽屜（討論也在那裡）。
 */
export default function DraftsDrawer({
  open,
  tree,
  marks,
  canEdit,
  onOpenSkill,
  onClose,
}: {
  open: boolean;
  tree: SkillTree;
  marks: Map<number, TalkMark>;
  canEdit: boolean;
  onOpenSkill: (id: number) => void;
  onClose: () => void;
}) {
  const danceStyleId = tree.danceStyle.id;
  const categories = sorted(tree.categories);
  const tiers = sorted(tree.tiers);
  const hasTree = categories.length > 0;
  const [text, setText] = useState("");
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tierId, setTierId] = useState<number | null>(null);
  const [addDrafts, { isLoading: adding }] = useAddDraftsMutation();
  const [placeDrafts, { isLoading: placing }] = usePlaceDraftsMutation();

  const names = draftNames(text);
  const target = { categoryId: categoryId ?? categories[0]?.id, tierId: tierId ?? tiers[0]?.id };

  const add = async () => {
    if (!names.length) return;
    if (names.length > MAX_DRAFT_PASTE) {
      toast.error(`一次最多 ${MAX_DRAFT_PASTE} 個`);
      return;
    }
    try {
      const { added, skipped } = await addDrafts({ danceStyleId, text }).unwrap();
      setText("");
      toast.success(
        [added.length && `加入 ${added.length} 個`, skipped.length && `${skipped.join("、")} 已經有了`]
          .filter(Boolean)
          .join("，") || "沒有新的名字"
      );
    } catch {
      toast.error("沒有加進去，請再試一次");
    }
  };

  const place = async () => {
    if (!target.categoryId || !target.tierId) return;
    try {
      const { placed, skipped } = await placeDrafts({
        danceStyleId,
        ids: [...selected],
        categoryId: target.categoryId,
        tierId: target.tierId,
      }).unwrap();
      setSelected(new Set());
      toast.success(
        [placed.length && `${placed.length} 張放進樹`, skipped.length && `${skipped.join("、")} 樹上已經有了`]
          .filter(Boolean)
          .join("，")
      );
    } catch {
      toast.error("沒有放進去，請再試一次");
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const footer =
    canEdit && selected.size > 0 && hasTree ? (
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="放進哪個分類"
          value={target.categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className={cn(fieldControlClass(), "h-11 min-w-0 flex-1 text-sm")}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="放進哪個等級"
          value={target.tierId}
          onChange={(e) => setTierId(Number(e.target.value))}
          className={cn(fieldControlClass(), "h-11 w-auto text-sm")}
        >
          {tiers.map((t, i) => (
            <option key={t.id} value={t.id}>
              {tierName(i)}
              {t.label && ` · ${t.label}`}
            </option>
          ))}
        </select>
        <Button onClick={place} isLoading={placing} className="w-full sm:w-auto">
          {selected.size} 張放進樹
        </Button>
      </div>
    ) : undefined;

  return (
    <Panel
      open={open}
      title={`待定區 ${tree.drafts.length}`}
      subtitle="還沒想好放哪的技能先丟這裡，大家可以先討論"
      onClose={onClose}
      footer={footer}
    >
      {canEdit && (
        <form
          className="mb-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          {multi ? (
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"一行一個，例如：\n- Hammerlock\n- Cuddle turn"}
              aria-label="貼上多個技能名稱"
              className={`${fieldControlClass()} py-2.5`}
            />
          ) : (
            <input
              value={text}
              maxLength={SKILL_NAME_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder="想教的東西，按 Enter 加入"
              aria-label="技能名稱"
              className={`${fieldControlClass()} h-12`}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="link" size="sm" onClick={() => setMulti((v) => !v)}>
              {multi ? "一次加一個" : "一次貼多行"}
            </Button>
            <Button type="submit" variant="secondary" size="sm" disabled={!names.length} isLoading={adding}>
              加入{names.length > 1 ? ` ${names.length} 個` : ""}
            </Button>
          </div>
        </form>
      )}

      {canEdit && !hasTree && tree.drafts.length > 0 && (
        <p className="mb-3 text-[13px] text-neutral-500">建好技能樹之後就能把它們放進去。</p>
      )}

      {tree.drafts.length === 0 ? (
        <EmptyState kind="inline" title="待定區是空的" description="想到要教什麼，還沒想好放哪，就先丟進來。" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {tree.drafts.map((draft) => {
            const mark = marks.get(draft.id);
            const checked = selected.has(draft.id);
            return (
              <li key={draft.id} className="flex items-center gap-3 px-3 py-2.5">
                {canEdit && hasTree && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`選取「${draft.name}」`}
                    onClick={() => toggle(draft.id)}
                    className={cn(
                      "grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm border-[1.5px]",
                      checked ? "border-primary-900 bg-primary-900 text-white" : "border-neutral-300 bg-white"
                    )}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenSkill(draft.id)}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
                >
                  <span className="truncate font-medium text-neutral-900">{draft.name}</span>
                  <span className="text-xs text-neutral-500">
                    {[tierText(tiers, draft.tierId), draft.createdBy && `${draft.createdBy.name} 加的`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                {mark && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      mark.fresh ? "bg-warning-100 text-warning-950" : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    <MessageCircle className="size-3" />
                    {mark.count}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
