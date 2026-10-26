"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import {
  useGetDanceStylesQuery,
  useReorderDanceStylesMutation,
  useUpdateDanceStyleMutation,
  type DanceStyle,
} from "@/store/slices/danceStyles";
import DanceStyleForm from "./DanceStyleForm";

type FormState = { open: false } | { open: true; style?: DanceStyle; key: number };

const iconButton = "text-neutral-500 disabled:opacity-30 disabled:hover:bg-transparent";

/** 每列寬度不同、越往下越淡（docs/design-system.md「骨架」）。 */
const SKELETON_ROWS = [
  { width: "w-28", fade: "" },
  { width: "w-20", fade: "" },
  { width: "w-32", fade: "opacity-50" },
  { width: "w-24", fade: "opacity-25" },
];

const RowsSkeleton = () => (
  <ul className="flex flex-col">
    {SKELETON_ROWS.map((row, i) => (
      <li key={i} className={`flex h-14 items-center gap-2 border-b border-neutral-200 ${row.fade}`}>
        <Skeleton className="size-3 shrink-0" />
        <Skeleton className={`h-3.5 ${row.width}`} />
      </li>
    ))}
  </ul>
);


const DanceStyleList = () => {
  // The raw list (archived included) rather than useDanceStyles(): this page
  // manages archived styles too, and reorders the full list.
  const { data: allStyles = [], isLoading } = useGetDanceStylesQuery();
  const [updateDanceStyle] = useUpdateDanceStyleMutation();
  const [reorderDanceStyles, { isLoading: reordering }] = useReorderDanceStylesMutation();
  const [form, setForm] = useState<FormState>({ open: false });
  const [showArchived, setShowArchived] = useState(false);

  const active = allStyles.filter((style) => !style.archivedAt);
  const archived = allStyles.filter((style) => style.archivedAt);

  const openForm = (style?: DanceStyle) => setForm({ open: true, style, key: Date.now() });

  const move = async (index: number, delta: -1 | 1) => {
    const next = [...active];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    // Archived styles go after the active ones; the API wants every id.
    try {
      await reorderDanceStyles([...next, ...archived].map((style) => style.id)).unwrap();
    } catch {
      toast.error("排序失敗，請重新整理後再試");
    }
  };

  const setArchived = async (style: DanceStyle, value: boolean) => {
    try {
      await updateDanceStyle({ id: style.id, archived: value }).unwrap();
      toast.success(value ? `已封存 ${style.name}` : `已還原 ${style.name}`);
    } catch {
      toast.error("操作失敗，請稍後再試");
    }
  };

  return (
    <>
      <div className="w-full px-5 py-3 lg:max-w-[720px] lg:px-8 lg:py-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-bold text-neutral-900">舞種</h2>
          <Button type="button" onClick={() => openForm()}>
            <Plus />
            新增舞種
          </Button>
        </div>
        <p className="text-sm text-neutral-600 mb-4">
          開課、複習卡和學生資格都從這裡選舞種。封存的舞種不會出現在選單，但舊課和舊卡照常顯示。
        </p>

        {isLoading && <RowsSkeleton />}

        {!isLoading && active.length === 0 && (
          <EmptyState title="還沒有舞種" description="先新增教室教的舞種，才能開課和建立複習卡。" />
        )}

        <ul className="flex flex-col">
          {active.map((style, index) => {
            const meta = danceStyleMeta(style);
            return (
              <li
                key={style.id}
                className="flex items-center gap-2 py-2.5 border-b border-neutral-200"
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${meta.dot}`} />
                <span className="font-medium text-neutral-900 truncate">{style.name}</span>
                {style.hasLevels && (
                  <StatusTag tone="neutral">分階</StatusTag>
                )}
                <div className="ml-auto flex items-center shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    aria-label={`${style.name} 上移`}
                    className={iconButton}
                    disabled={index === 0 || reordering}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    aria-label={`${style.name} 下移`}
                    className={iconButton}
                    disabled={index === active.length - 1 || reordering}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    aria-label={`編輯 ${style.name}`}
                    className={iconButton}
                    onClick={() => openForm(style)}
                  >
                    <Pencil className="w-4.5 h-4.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    aria-label={`封存 ${style.name}`}
                    title="封存"
                    className={iconButton}
                    onClick={() => setArchived(style, true)}
                  >
                    <Archive className="w-4.5 h-4.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        {archived.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex min-h-11 items-center gap-1 text-sm font-medium text-neutral-600 cursor-pointer"
              aria-expanded={showArchived}
            >
              {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              已封存（{archived.length}）
            </button>
            {showArchived && (
              <ul className="flex flex-col mt-2">
                {archived.map((style) => {
                  const meta = danceStyleMeta(style);
                  return (
                    <li
                      key={style.id}
                      className="flex items-center gap-2 py-2.5 border-b border-neutral-200 text-neutral-500"
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 opacity-50 ${meta.dot}`} />
                      <span className="truncate">{style.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setArchived(style, false)}
                        className="ml-auto gap-1.5 text-primary-700 hover:bg-primary-50 shrink-0"
                      >
                        <ArchiveRestore className="size-4" />
                        還原
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {form.open && (
        <DanceStyleForm
          key={form.key}
          open
          style={form.style}
          allStyles={allStyles}
          onClose={() => setForm({ open: false })}
        />
      )}
    </>
  );
};

export default DanceStyleList;
