"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { threadsOf, type TalkComment } from "@/domains/curriculum/talk";
import { useMarkSkillReadMutation } from "@/store/slices/curriculum";
import { ago } from "../format";
import type { TalkContext } from "../useTalkContext";
import CommentItem from "./CommentItem";
import Composer from "./Composer";
import Mentions from "./Mentions";

/**
 * 一個技能的討論，像 Threads：直接留言、按表情，點一則進去看回覆。
 * 結論釘在最上面，留言框固定在底部（撐滿抽屜剩下的高度，自己捲）。打開就算讀過。
 */
export default function TalkBoard({
  ctx,
  danceStyleId,
  skillId,
  comments,
}: {
  ctx: TalkContext;
  danceStyleId: number;
  skillId: number;
  comments: TalkComment[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [markRead] = useMarkSkillReadMutation();
  const threads = threadsOf(comments, skillId);
  const pinned = comments.find((c) => c.skillId === skillId && c.conclusion);
  const thread = threads.find((t) => t.id === openId);
  const latest = comments.filter((c) => c.skillId === skillId).length;
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(latest);

  // Opening the board, and every new comment while it's open, counts as read.
  useEffect(() => {
    markRead({ danceStyleId, skillId });
  }, [markRead, danceStyleId, skillId, latest]);

  // A new comment lands at the bottom, next to the box — follow it there.
  useEffect(() => {
    if (latest > seen.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    seen.current = latest;
  }, [latest]);

  const layout = (body: React.ReactNode, composer: React.ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 lg:px-6">
        {body}
      </div>
      <div className="border-t border-neutral-200 px-5 pt-3 pb-4 lg:px-6">{composer}</div>
    </div>
  );

  if (thread) {
    return layout(
      <>
        <Button variant="link" className="w-fit gap-1.5" onClick={() => setOpenId(null)}>
          <ArrowLeft className="size-4" />
          討論
        </Button>
        <CommentItem ctx={ctx} comment={thread} lead />
        <p className="border-y border-neutral-200 py-2 text-[13px] font-medium text-neutral-500">
          {thread.replies.length ? `${thread.replies.length} 則回覆` : "還沒有回覆"}
        </p>
        {thread.replies.map((r) => (
          <CommentItem key={r.id} ctx={ctx} comment={r} />
        ))}
      </>,
      <Composer
        ctx={ctx}
        skillId={skillId}
        parentId={thread.id}
        placeholder={`回覆 ${thread.authorId === ctx.me ? "自己" : thread.author}…`}
      />
    );
  }

  return layout(
    <>
      {pinned && (
        <section aria-label="結論" className="flex flex-col gap-1.5 rounded-2xl bg-primary-50 p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-primary-900">
            <Check className="size-4" />
            結論
            <span className="font-normal text-neutral-500">
              · {pinned.conclusion!.by} {ago(pinned.conclusion!.at)}標的
            </span>
            {pinned.parentId && (
              <Button variant="link" size="sm" className="ml-auto" onClick={() => setOpenId(pinned.parentId)}>
                看討論串
              </Button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-[15px] text-neutral-900">
            <Mentions text={pinned.text} people={ctx.people} />
          </p>
          <span className="text-xs text-neutral-500">{pinned.authorId === ctx.me ? "你" : pinned.author} 的留言</span>
        </section>
      )}
      {threads.map((t) => (
        <CommentItem key={t.id} ctx={ctx} comment={t} replies={t.replies} onOpen={() => setOpenId(t.id)} />
      ))}
      {!threads.length && (
        <EmptyState
          kind="inline"
          title="還沒有人留言"
          description="覺得這招要不要教、放哪裡、怎麼教，都可以先寫在這裡。"
        />
      )}
    </>,
    <Composer ctx={ctx} skillId={skillId} placeholder="留言給大家…" />
  );
}
