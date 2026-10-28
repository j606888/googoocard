"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { cn } from "@/lib/utils";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetFinanceQuestsQuery, useMarkFinanceQuestMutation, type QuestItem } from "@/store/slices/finance";
import { Panel } from "../ui";
import { financeHref } from "../routes";
import PushAction from "./PushAction";
import TrialDialog from "./TrialDialog";

const ROLE_LABEL = { owner: "擁有者", revenueOwner: "營收負責人", holder: "代收人" } as const;

const INVITE_TEXT = (url: string) =>
  `水庫開張了！之後收的課卡錢，都在這裡送回給老闆確認：\n${url}\n\n請用手機打開，按瀏覽器的「分享」→「加入主畫面」，從主畫面打開後開啟通知，有事才收得到。`;

/**
 * 新手任務（docs/finance-plan.md §4.4）：依角色合併，真的做到才打勾，全部完成就收掉。
 * 下一個要做的那項展開，帶著它的動作。
 */
export default function QuestPanel() {
  const { data } = useGetFinanceQuestsQuery();
  const { data: me } = useGetMeQuery();
  const [mark] = useMarkFinanceQuestMutation();
  const [open, setOpen] = useState(true);
  const [trial, setTrial] = useState(false);
  if (!data || data.allDone || !me) return null;

  const done = data.quests.filter((q) => q.done).length;
  const nextKey = data.quests.find((q) => !q.done)?.key;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(INVITE_TEXT(`${window.location.origin}${financeHref.home}`));
      await mark("notifiedMembers").unwrap();
      toast.success("複製好了，貼到 LINE 群組吧");
    } catch {
      toast.error("沒有複製成功，請再試一次");
    }
  };

  const action = (q: QuestItem) => {
    switch (q.key) {
      case "push":
        return <PushAction compact />;
      case "trial":
        return (
          <Button size="sm" onClick={() => setTrial(true)}>
            試玩
          </Button>
        );
      case "notifiedMembers":
        return (
          <Button size="sm" onClick={copyInvite}>
            複製訊息
          </Button>
        );
      case "firstEntry":
        return <Link className="text-sm font-semibold text-primary-700" href={financeHref.vault}>去大水庫記一筆 ›</Link>;
      case "viewedBackpack":
      case "firstRemit":
        return <Link className="text-sm font-semibold text-primary-700" href={financeHref.holder(me.id)}>打開我的背包 ›</Link>;
      default:
        return null;
    }
  };

  return (
    <Panel className="lg:sticky lg:top-6">
      <button type="button" className="flex items-center justify-between gap-3 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="flex flex-col">
          <span className="text-lg font-bold text-neutral-900">新手任務</span>
          <span className="flex flex-wrap gap-1 pt-1">
            {data.roles.map((r) => (
              <StatusTag key={r} tone="outline">
                {ROLE_LABEL[r]}
              </StatusTag>
            ))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-primary-900">
            {done} / {data.quests.length}
          </span>
          <ChevronDown className={cn("size-5 text-neutral-500 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <ol className="flex flex-col">
          {data.quests.map((q) => {
            const isNext = q.key === nextKey;
            return (
              <li key={q.key} className="flex gap-3 py-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                    q.done ? "bg-primary-600 text-white" : isNext ? "bg-warning-300 text-warning-950" : "border-[1.5px] border-neutral-300"
                  )}
                >
                  {q.done ? <Check className="size-3.5" /> : isNext ? "!" : ""}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className={cn("text-sm font-semibold", q.done ? "text-neutral-500 line-through" : "text-neutral-900")}>
                    {q.label}
                    <span className="sr-only">{q.done ? "（完成）" : "（還沒完成）"}</span>
                  </span>
                  {!q.done && q.hint && <span className="text-[13px] text-neutral-500">{q.hint}</span>}
                  {!q.done && isNext && action(q)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[13px] text-neutral-500">真的做到了才打勾；全部完成就會收起來。</p>
      <TrialDialog open={trial} onClose={() => setTrial(false)} onDone={() => mark("trial")} />
    </Panel>
  );
}
