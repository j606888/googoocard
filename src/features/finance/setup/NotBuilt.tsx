"use client";

import { Hammer } from "lucide-react";
import type { FinanceSettingState } from "@/store/slices/finance";
import { Panel } from "../ui";
import PushAction from "../quests/PushAction";
import SetupWizard from "./SetupWizard";

/**
 * 還沒建城。能建城的人（有 finance.edit，或已經被選為營收負責人）看到建城任務；
 * 其他人看到「主堡施工中」，只能先開通知。
 */
export default function NotBuilt({ state, meId }: { state: FinanceSettingState; meId: number }) {
  if (state.canEdit || state.isRevenueOwner) return <SetupWizard state={state} meId={meId} />;

  const owner = state.members.find((m) => m.id === state.setting?.revenueOwnerUserId);
  return (
    <Panel className="max-w-[560px]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-50 text-warning-950">
          <Hammer className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">主堡施工中</h2>
          <p className="text-[13px] text-neutral-500">{owner ? `等 ${owner.name} 完成建城` : "等管理員選好營收負責人"}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-neutral-600">
        建好之後，你收的課卡錢會出現在你的背包，按「送回主堡」交給{owner ? ` ${owner.name}` : "營收負責人"}。
      </p>
      <div className="flex flex-col gap-2 border-t border-dashed border-neutral-200 pt-3">
        <p className="text-sm font-bold text-neutral-900">現在可以先做：開啟通知</p>
        <PushAction />
      </div>
    </Panel>
  );
}
