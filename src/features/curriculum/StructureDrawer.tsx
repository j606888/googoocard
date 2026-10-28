"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import Select from "@/components/Select";
import { DANCE_STYLE_COLORS } from "@/lib/danceStyles";
import { cn } from "@/lib/utils";
import {
  CATEGORY_NAME_MAX,
  MAX_TIERS,
  SKILL_CATEGORY_ICONS,
  TIER_LABEL_MAX,
  sorted,
  tierName,
  unusedColor,
} from "@/domains/curriculum/skillTree";
import {
  useCreateSkillCategoryMutation,
  useCreateSkillTierMutation,
  useDeleteSkillCategoryMutation,
  useDeleteSkillTierMutation,
  useMoveSkillCategoryMutation,
  useMoveSkillTierMutation,
  useUpdateSkillCategoryMutation,
  useUpdateSkillTierMutation,
  type SkillCategory,
  type SkillTree,
} from "@/store/slices/curriculum";
import { CATEGORY_ICONS, CategoryMark } from "./categoryIcons";
import { categoryColor } from "./categoryColors";
import Panel from "./Panel";

const iconButton = "text-neutral-500 disabled:opacity-30 disabled:hover:bg-transparent";
const fail = () => toast.error("沒有成功，請再試一次");

/** Where a deleted 分類／等級's skills go: another one, or archived with it. */
function DeleteChoice({
  what,
  count,
  options,
  onConfirm,
  onCancel,
  busy,
}: {
  what: string;
  count: number;
  options: { id: number; name: string }[];
  onConfirm: (moveTo: number | null) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [moveTo, setMoveTo] = useState<string>(options[0] ? String(options[0].id) : "archive");
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 p-3">
      <p className="text-sm text-neutral-900">
        刪除這個{what}？{count > 0 ? `上面有 ${count} 個技能：` : "上面沒有技能。"}
      </p>
      {count > 0 && (
        <Select
          aria-label="技能要搬去哪"
          size="sm"
          value={moveTo}
          onChange={setMoveTo}
          options={[
            ...options.map((o) => ({ value: String(o.id), label: `搬到「${o.name}」` })),
            { value: "archive", label: "一起從樹上移除（封存）" },
          ]}
        />
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          isLoading={busy}
          onClick={() => onConfirm(moveTo === "archive" || count === 0 ? null : Number(moveTo))}
        >
          刪除
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  index,
  total,
  skillCount,
  others,
}: {
  category: SkillCategory;
  index: number;
  total: number;
  skillCount: number;
  others: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [update] = useUpdateSkillCategoryMutation();
  const [move, { isLoading: moving }] = useMoveSkillCategoryMutation();
  const [remove, { isLoading: removing }] = useDeleteSkillCategoryMutation();

  const save = (patch: Partial<Pick<SkillCategory, "name" | "color" | "icon">>) =>
    update({ id: category.id, ...patch }).unwrap().catch(fail);

  return (
    <li className="border-b border-neutral-200 py-2.5">
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-pointer" onClick={() => setEditing((v) => !v)} aria-label={`改「${category.name}」的顏色與圖示`}>
          <CategoryMark category={category} />
        </button>
        <input
          key={category.name}
          defaultValue={category.name}
          maxLength={CATEGORY_NAME_MAX}
          aria-label="分類名稱"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== category.name) save({ name });
          }}
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 font-medium text-neutral-900 outline-none hover:bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-primary-100"
        />
        <span className="shrink-0 text-xs text-neutral-500">{skillCount} 個</span>
        <Button variant="ghost" size="iconSm" className={iconButton} disabled={index === 0 || moving} onClick={() => move({ id: category.id, dir: -1 }).unwrap().catch(fail)} aria-label="往前">
          <ChevronUp className="size-4" />
        </Button>
        <Button variant="ghost" size="iconSm" className={iconButton} disabled={index === total - 1 || moving} onClick={() => move({ id: category.id, dir: 1 }).unwrap().catch(fail)} aria-label="往後">
          <ChevronDown className="size-4" />
        </Button>
        <Button variant="ghost" size="iconSm" className={iconButton} disabled={total <= 1} onClick={() => setDeleting(true)} aria-label={`刪除「${category.name}」`}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {editing && (
        <div className="mt-2 flex flex-col gap-2 pl-10">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="顏色">
            {DANCE_STYLE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={category.color === color}
                onClick={() => save({ color })}
                style={{ background: categoryColor(color).fill }}
                className={cn(
                  "size-7 cursor-pointer rounded-full",
                  category.color === color && "ring-2 ring-primary-900 ring-offset-2"
                )}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="圖示">
            {SKILL_CATEGORY_ICONS.map((icon) => {
              const Icon = CATEGORY_ICONS[icon];
              return (
                <button
                  key={icon}
                  type="button"
                  aria-label={icon}
                  aria-pressed={category.icon === icon}
                  onClick={() => save({ icon })}
                  className={cn(
                    "grid size-8 cursor-pointer place-items-center rounded-lg border text-neutral-700",
                    category.icon === icon ? "border-primary-900 bg-primary-50" : "border-neutral-200"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {deleting && (
        <DeleteChoice
          what="分類"
          count={skillCount}
          options={others}
          busy={removing}
          onCancel={() => setDeleting(false)}
          onConfirm={(moveTo) =>
            remove({ id: category.id, moveTo })
              .unwrap()
              .then(() => toast.success(`已刪除「${category.name}」`))
              .catch(fail)
          }
        />
      )}
    </li>
  );
}

/** 分類與等級：新增、改名、排序、刪除（技能要搬去哪）。 */
export default function StructureDrawer({
  open,
  tree,
  onClose,
}: {
  open: boolean;
  tree: SkillTree;
  onClose: () => void;
}) {
  const danceStyleId = tree.danceStyle.id;
  const categories = sorted(tree.categories);
  const tiers = sorted(tree.tiers);
  const [newName, setNewName] = useState("");
  const [createCategory, { isLoading: creating }] = useCreateSkillCategoryMutation();
  const [createTier, { isLoading: creatingTier }] = useCreateSkillTierMutation();
  const [updateTier] = useUpdateSkillTierMutation();
  const [moveTier, { isLoading: movingTier }] = useMoveSkillTierMutation();
  const [deleteTier, { isLoading: deletingTier }] = useDeleteSkillTierMutation();
  const [deletingTierId, setDeletingTierId] = useState<number | null>(null);

  // Skills on the tree that a delete would move or archive.
  const countIn = (key: "categoryId" | "tierId", id: number) => tree.skills.filter((s) => s[key] === id).length;

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory({ danceStyleId, name, color: unusedColor(categories), icon: "star" }).unwrap();
      setNewName("");
    } catch {
      fail();
    }
  };

  return (
    <Panel open={open} title="分類與等級" subtitle={tree.danceStyle.name} onClose={onClose}>
      <section className="flex flex-col">
        <h3 className="mb-1 text-sm font-bold text-neutral-900">分類</h3>
        <p className="mb-2 text-[13px] text-neutral-500">點圓圈換顏色與圖示，名稱直接改。</p>
        <ul className="flex flex-col">
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              category={c}
              index={i}
              total={categories.length}
              skillCount={countIn("categoryId", c.id)}
              others={categories.filter((o) => o.id !== c.id)}
            />
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addCategory();
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={CATEGORY_NAME_MAX}
            placeholder="新分類名稱"
            aria-label="新分類名稱"
            className={cn(fieldControlClass(), "h-11 flex-1")}
          />
          <Button type="submit" variant="secondary" disabled={!newName.trim()} isLoading={creating}>
            <Plus />
            新增
          </Button>
        </form>
      </section>

      <section className="mt-6 flex flex-col">
        <h3 className="mb-1 text-sm font-bold text-neutral-900">等級</h3>
        <p className="mb-2 text-[13px] text-neutral-500">名稱照順序是一轉、二轉…，標籤可以自己寫（例如 Lv1）。</p>
        <ul className="flex flex-col">
          {tiers.map((t, i) => (
            <li key={t.id} className="border-b border-neutral-200 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-medium text-neutral-900">{tierName(i)}</span>
                <input
                  key={t.label}
                  defaultValue={t.label}
                  maxLength={TIER_LABEL_MAX}
                  placeholder="標籤"
                  aria-label={`${tierName(i)}的標籤`}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label !== t.label) updateTier({ id: t.id, label }).unwrap().catch(fail);
                  }}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-neutral-700 outline-none hover:bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-primary-100"
                />
                <span className="shrink-0 text-xs text-neutral-500">{countIn("tierId", t.id)} 個</span>
                <Button variant="ghost" size="iconSm" className={iconButton} disabled={i === 0 || movingTier} onClick={() => moveTier({ id: t.id, dir: -1 }).unwrap().catch(fail)} aria-label="往前">
                  <ChevronUp className="size-4" />
                </Button>
                <Button variant="ghost" size="iconSm" className={iconButton} disabled={i === tiers.length - 1 || movingTier} onClick={() => moveTier({ id: t.id, dir: 1 }).unwrap().catch(fail)} aria-label="往後">
                  <ChevronDown className="size-4" />
                </Button>
                <Button variant="ghost" size="iconSm" className={iconButton} disabled={tiers.length <= 1} onClick={() => setDeletingTierId(t.id)} aria-label={`刪除${tierName(i)}`}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {deletingTierId === t.id && (
                <DeleteChoice
                  what="等級"
                  count={countIn("tierId", t.id)}
                  options={tiers.flatMap((o, j) => (o.id === t.id ? [] : [{ id: o.id, name: tierName(j) }]))}
                  busy={deletingTier}
                  onCancel={() => setDeletingTierId(null)}
                  onConfirm={(moveTo) =>
                    deleteTier({ id: t.id, moveTo })
                      .unwrap()
                      .then(() => {
                        setDeletingTierId(null);
                        toast.success(`已刪除${tierName(i)}`);
                      })
                      .catch(fail)
                  }
                />
              )}
            </li>
          ))}
        </ul>
        {tiers.length < MAX_TIERS && (
          <Button
            variant="secondary"
            className="mt-3 w-fit"
            isLoading={creatingTier}
            onClick={() => createTier({ danceStyleId, label: "" }).unwrap().catch(fail)}
          >
            <Plus />
            新增{tierName(tiers.length)}
          </Button>
        )}
      </section>
    </Panel>
  );
}
