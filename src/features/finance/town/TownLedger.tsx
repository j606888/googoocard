"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilterChip from "@/components/FilterChip";
import StatusTag from "@/components/StatusTag";
import Money from "../Money";
import { Panel } from "../ui";
import { companyMoney, ledgerRows, type LedgerScope, type RemitStatus, type TownState } from "./townModel";

const STATUS: Record<RemitStatus, { label: string; tone: "positive" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "等確認", tone: "warning" },
  confirmed: { label: "已入庫", tone: "positive" },
  rejected: { label: "退回", tone: "danger" },
  withdrawn: { label: "撤回", tone: "neutral" },
};

/**
 * 帳本模式（style doc §5 第 2 條）：同一份資料的明細表，用一般設計系統、不遊戲化。
 * 對帳、找某一筆都在這裡做。
 */
export default function TownLedger({ state, onBack }: { state: TownState; onBack: () => void }) {
  const [scope, setScope] = useState<LedgerScope | "all">("all");
  const rows = ledgerRows(state).filter((r) => scope === "all" || r.scope === scope);
  const money = companyMoney(state);
  return (
    <div className="flex w-full max-w-[960px] flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900">帳本</h1>
          <p className="text-sm text-neutral-500">
            主堡財庫 <Money value={money.vault} className="font-semibold text-neutral-900" /> · 公司的錢 <Money value={money.total} className="font-semibold text-neutral-900" />
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          回到小鎮
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={scope === "all"} onClick={() => setScope("all")}>
          全部
        </FilterChip>
        <FilterChip active={scope === "vault"} onClick={() => setScope("vault")}>
          主堡（大水庫）
        </FilterChip>
        <FilterChip active={scope === "custody"} onClick={() => setScope("custody")}>
          代收、在路上
        </FilterChip>
      </div>
      <Panel>
        <ul className="divide-y divide-neutral-200">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-12 shrink-0 text-[13px] tabular-nums text-neutral-500">{r.date.slice(5).replace("-", "/")}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                  {r.title}
                  {r.status && <StatusTag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusTag>}
                </span>
                {r.detail && <span className="block text-[13px] text-neutral-500">{r.detail}</span>}
              </span>
              <Money value={r.amount} sign colored className="shrink-0 text-sm font-semibold" />
            </li>
          ))}
          <li className="flex items-center gap-3 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500">
            <span className="w-12 shrink-0 tabular-nums">09/30</span>
            <span className="flex-1">期初（主堡）</span>
            <Money value={48000} className="font-semibold" />
          </li>
        </ul>
      </Panel>
    </div>
  );
}
