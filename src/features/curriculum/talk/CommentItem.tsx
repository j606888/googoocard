"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, MessageCircle, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import Menu from "@/components/Menu";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import StatusTag from "@/components/StatusTag";
import { COMMENT_MAX, REACTIONS, type Reaction, type TalkComment } from "@/domains/curriculum/talk";
import {
  useDeleteCommentMutation,
  useEditCommentMutation,
  useReactToCommentMutation,
  useSetConclusionMutation,
} from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";
import { ago } from "../format";
import type { TalkContext } from "../useTalkContext";
import Mentions from "./Mentions";

const menuItem =
  "flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-neutral-100";

/** One comment: avatar, name, time, text, reactions, ⋯ menu; replies count opens its thread. */
export default function CommentItem({
  ctx,
  comment,
  replies,
  onOpen,
  lead = false,
}: {
  ctx: TalkContext;
  comment: TalkComment;
  /** Top-level only: its replies, for the 「N 則回覆」 row. */
  replies?: TalkComment[];
  onOpen?: () => void;
  /** The thread's opening comment, drawn a little larger. */
  lead?: boolean;
}) {
  // `Menu`, not Radix Popover: inside the skill dialog a popover portaled to
  // <body> can't be clicked (the modal dialog disables pointer events there).
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const pickerAnchor = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [react] = useReactToCommentMutation();
  const [setConclusion] = useSetConclusionMutation();
  const [edit, { isLoading: saving }] = useEditCommentMutation();
  const [remove, { isLoading: removing }] = useDeleteCommentMutation();

  const mine = comment.authorId === ctx.me;
  const name = mine ? "你" : comment.author;
  const myReaction = comment.reactions.find((r) => r.people.some((p) => p.id === ctx.me))?.kind;

  const onReact = async (kind: Reaction) => {
    setPickerOpen(false);
    try {
      await react({ id: comment.id, kind }).unwrap();
    } catch {
      toast.error("沒有成功，請再試一次");
    }
  };

  const toggleConclusion = async () => {
    setMenuOpen(false);
    try {
      await setConclusion({ id: comment.id, on: !comment.conclusion }).unwrap();
      toast.success(comment.conclusion ? "已取消結論" : "已標成結論");
    } catch {
      toast.error("沒有成功，請再試一次");
    }
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    try {
      await edit({ id: comment.id, text: draft }).unwrap();
      setEditing(false);
    } catch {
      toast.error("沒有存到，請再試一次");
    }
  };

  const onDelete = async () => {
    try {
      await remove({ id: comment.id }).unwrap();
      setConfirmDelete(false);
      toast.success("已刪除");
    } catch {
      toast.error("沒有刪掉，請再試一次");
    }
  };

  return (
    <article className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-primary-100 font-bold text-primary-900",
          lead ? "size-10 text-[15px]" : "size-8 text-sm"
        )}
      >
        {name.slice(0, 1)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{name}</span>
          <span className="text-xs text-neutral-500">
            {ago(comment.createdAt)}
            {comment.editedAt && " · 已編輯"}
          </span>
          {comment.conclusion && <StatusTag tone="positive">結論</StatusTag>}
          <Button
            ref={menuAnchor}
            variant="ghost"
            size="iconSm"
            aria-label="更多"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-auto -mr-1.5 size-8 text-neutral-500"
          >
            <MoreHorizontal className="size-4" />
          </Button>
          <Menu
            open={menuOpen}
            anchorEl={menuAnchor.current}
            onClose={() => setMenuOpen(false)}
            placement="bottom-end"
            className="z-50 flex w-64 flex-col rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-lg"
          >
              <button type="button" className={menuItem} onClick={toggleConclusion}>
                <Check className="mt-0.5 size-4 shrink-0" />
                <span className="flex flex-col">
                  {comment.conclusion ? "取消結論" : "標成結論"}
                  <span className="text-xs text-neutral-500">
                    {comment.conclusion ? "這個技能會回到「討論中」" : "放到最上面，這個技能就不算「討論中」"}
                  </span>
                </span>
              </button>
              {mine && (
                <button
                  type="button"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setDraft(comment.text);
                    setEditing(true);
                  }}
                >
                  <Pencil className="mt-0.5 size-4 shrink-0" />
                  編輯
                </button>
              )}
              {(mine || ctx.canModerate) && (
                <button
                  type="button"
                  className={cn(menuItem, "text-danger-700 hover:bg-danger-50")}
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 className="mt-0.5 size-4 shrink-0" />
                  刪除
                </button>
              )}
          </Menu>
        </div>

        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
          >
            <textarea
              rows={3}
              value={draft}
              maxLength={COMMENT_MAX}
              autoFocus
              aria-label="編輯留言"
              onChange={(e) => setDraft(e.target.value)}
              className={`${fieldControlClass()} py-2.5`}
            />
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={!draft.trim()} isLoading={saving}>
                儲存
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          </form>
        ) : (
          <p className={cn("whitespace-pre-wrap break-words text-neutral-800", lead ? "text-base" : "text-[15px]")}>
            <Mentions text={comment.text} people={ctx.people} />
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {comment.reactions.map((r) => {
            const e = REACTIONS.find((x) => x.id === r.kind);
            if (!e) return null;
            const on = r.kind === myReaction;
            const who = r.people.map((p) => (p.id === ctx.me ? "你" : p.name)).join("、");
            return (
              <button
                key={r.kind}
                type="button"
                aria-pressed={on}
                title={`${e.label}：${who}`}
                aria-label={`${e.label} ${r.people.length}：${who}`}
                onClick={() => onReact(r.kind)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs font-semibold",
                  on ? "border-primary-300 bg-primary-50 text-primary-900" : "border-neutral-200 bg-white text-neutral-600"
                )}
              >
                <span aria-hidden="true">{e.char}</span>
                {r.people.length}
              </button>
            );
          })}
          <Button
            ref={pickerAnchor}
            variant="ghost"
            size="iconSm"
            aria-label="加上表情"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            className="size-8 text-neutral-500"
          >
            <SmilePlus className="size-4" />
          </Button>
          <Menu
            open={pickerOpen}
            anchorEl={pickerAnchor.current}
            onClose={() => setPickerOpen(false)}
            className="z-50 flex flex-row gap-0.5 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-lg"
          >
              {REACTIONS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  title={e.label}
                  aria-label={e.label}
                  aria-pressed={e.id === myReaction}
                  onClick={() => onReact(e.id)}
                  className={cn(
                    "grid size-9 cursor-pointer place-items-center rounded-lg text-lg hover:bg-neutral-100",
                    e.id === myReaction && "bg-primary-50"
                  )}
                >
                  {e.char}
                </button>
              ))}
          </Menu>
          {onOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpen}
              className="h-8 gap-1 px-2 text-neutral-500"
              aria-label={replies?.length ? `${replies.length} 則回覆` : "回覆"}
            >
              <MessageCircle className="size-4" />
              {replies?.length ? replies.length : "回覆"}
            </Button>
          )}
        </div>

        {onOpen && !!replies?.length && (
          <button
            type="button"
            onClick={onOpen}
            className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
          >
            <span aria-hidden="true" className="flex -space-x-1.5">
              {[...new Set(replies.map((r) => (r.authorId === ctx.me ? "你" : r.author)))].slice(0, 3).map((n) => (
                <span
                  key={n}
                  className="grid size-5 place-items-center rounded-full border border-white bg-primary-100 text-[10px] font-bold text-primary-900"
                >
                  {n.slice(0, 1)}
                </span>
              ))}
            </span>
            {replies.length} 則回覆
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="刪除這則留言？"
        message={replies?.length ? "底下的回覆也會一起刪掉。" : "刪掉就救不回來了。"}
        confirmLabel="刪除"
        variant="danger"
        isLoading={removing}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
