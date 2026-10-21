"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Music, Pencil, Plus } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import {
  useGetDanceStylesQuery,
  useReorderDanceStylesMutation,
  useUpdateDanceStyleMutation,
  type DanceStyle,
} from "@/store/slices/danceStyles";
import DanceStyleForm from "./DanceStyleForm";

type FormState = { open: false } | { open: true; style?: DanceStyle; key: number };

const iconButton =
  "w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";

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

  if (isLoading) return <ListSkeleton />;

  return (
    <>
      <div className="w-full px-5 py-3 lg:max-w-[720px] lg:px-8 lg:py-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-semibold">舞種</h2>
          <button
            type="button"
            onClick={() => openForm()}
            className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">新增舞種</span>
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
          開課、複習卡和學生資格都從這裡選舞種。封存的舞種不會出現在選單，但舊課和舊卡照常顯示。
        </p>

        {active.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-lg font-bold">還沒有舞種</p>
              <p className="text-sm text-neutral-500 text-center">
                先新增教室教的舞種，才能開課和建立複習卡。
              </p>
            </div>
          </div>
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
                <span className="font-medium truncate">{style.name}</span>
                {style.hasLevels && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
                    分階
                  </span>
                )}
                <div className="ml-auto flex items-center shrink-0">
                  <button
                    type="button"
                    aria-label={`${style.name} 上移`}
                    className={iconButton}
                    disabled={index === 0 || reordering}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${style.name} 下移`}
                    className={iconButton}
                    disabled={index === active.length - 1 || reordering}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`編輯 ${style.name}`}
                    className={iconButton}
                    onClick={() => openForm(style)}
                  >
                    <Pencil className="w-4.5 h-4.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`封存 ${style.name}`}
                    title="封存"
                    className={iconButton}
                    onClick={() => setArchived(style, true)}
                  >
                    <Archive className="w-4.5 h-4.5" />
                  </button>
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
              className="flex items-center gap-1 text-sm font-medium text-neutral-500 cursor-pointer"
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
                      <button
                        type="button"
                        onClick={() => setArchived(style, false)}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-primary-700 hover:bg-primary-50 cursor-pointer shrink-0"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                        還原
                      </button>
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
