"use client";

import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import { COMMENT_MAX, typingMention, type Person } from "@/domains/curriculum/talk";
import { usePostCommentMutation } from "@/store/slices/curriculum";
import type { TalkContext } from "../useTalkContext";

/** 留言框：打 @ 跳出成員，⌘／Ctrl＋Enter 送出。 */
export default function Composer({
  ctx,
  skillId,
  parentId,
  placeholder,
}: {
  ctx: TalkContext;
  skillId: number;
  parentId?: number;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const [post, { isLoading }] = usePostCommentMutation();
  const typing = typingMention(text);
  const hits =
    typing === null
      ? []
      : ctx.people
          .filter((p) => p.id !== ctx.me && p.name.toLowerCase().includes(typing.toLowerCase()))
          .slice(0, 6);

  const send = async () => {
    if (!text.trim() || isLoading) return;
    try {
      await post({ skillId, text, parentId }).unwrap();
      setText("");
    } catch {
      toast.error("留言沒有送出，請再試一次");
    }
  };

  const pick = (person: Person) => {
    setText((t) => `${t.slice(0, t.length - (typing?.length ?? 0) - 1)}@${person.name} `);
    box.current?.focus();
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className={`${fieldControlClass()} flex items-end gap-2 py-2 pr-2`}>
        <textarea
          ref={box}
          rows={text.includes("\n") ? 3 : 1}
          value={text}
          maxLength={COMMENT_MAX}
          placeholder={placeholder}
          aria-label={placeholder.replace("…", "")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          className="min-h-7 flex-1 resize-none bg-transparent py-0.5 text-base outline-none placeholder:text-neutral-400"
        />
        <Button type="submit" size="iconSm" aria-label="送出" disabled={!text.trim()} isLoading={isLoading}>
          <ArrowUp />
        </Button>
      </div>
      {hits.length > 0 && (
        <div role="listbox" aria-label="提醒誰" className="flex flex-wrap gap-1.5">
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => pick(p)}
              className="cursor-pointer rounded-full border border-primary-300 bg-white px-3 py-1 text-sm font-medium text-primary-900 hover:bg-primary-50"
            >
              @{p.name}
            </button>
          ))}
        </div>
      )}
      {!text && <p className="text-xs text-neutral-500">打 @ 可以提醒某位成員 · ⌘ Enter 送出</p>}
    </form>
  );
}
