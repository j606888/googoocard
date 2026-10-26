"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Money, { EXPENSE_TEXT, moneyText } from "../Money";
import type { PoolHolder } from "../types";
import { Panel, PanelTitle } from "../ui";

/** 小水庫裡「現金在誰手上」；把其他老師的錢收齊到保管人只是換手，餘額不變。 */
export default function HolderList({
  keeper,
  holders,
  canEdit,
}: {
  keeper: string;
  holders: PoolHolder[];
  canEdit: boolean;
}) {
  const [list, setList] = useState(holders);

  const collect = (holder: PoolHolder) => {
    setList((current) =>
      current
        .filter((h) => h.name !== holder.name)
        .map((h) => (h.name === keeper ? { ...h, amount: h.amount + holder.amount } : h))
    );
    toast.success(`（示意）${holder.name} 的 ${moneyText(holder.amount)} 已交給${keeper}`);
  };

  const pending = list.filter((h) => h.pending);

  return (
    <Panel className="flex flex-col gap-1 p-4 lg:p-6">
      <PanelTitle className="mb-2">現金在誰手上</PanelTitle>
      {list.map((h) => (
        <div key={h.name} className="flex items-center justify-between gap-3 border-b border-neutral-100 py-3 last:border-0">
          <div className="min-w-0">
            <div className="text-[15px] text-neutral-900">{h.name === keeper ? `${h.name}（保管人）` : h.name}</div>
            {(h.note || h.pending) && (
              <div className={cn("text-[13px]", h.pending ? EXPENSE_TEXT : "text-neutral-500")}>
                {[h.note, h.pending ? `還沒交給${keeper}` : null].filter(Boolean).join("，")}
              </div>
            )}
          </div>
          <Money value={h.amount} className="shrink-0 text-lg text-neutral-900" />
        </div>
      ))}
      {canEdit &&
        pending.map((h) => (
          <Button key={h.name} variant="secondary" className="mt-1" onClick={() => collect(h)}>
            {h.name} 已交給{keeper}
          </Button>
        ))}
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
        {pending.length > 0
          ? `按下後只會把錢從其他老師手上移到${keeper}手上，小水庫餘額不變。`
          : "錢都收齊了，可以繳回大水庫。"}
      </p>
    </Panel>
  );
}
