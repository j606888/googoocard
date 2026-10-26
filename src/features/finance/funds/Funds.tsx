"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import DataView, { type DataViewColumn } from "@/components/DataView";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import Money from "../Money";
import { branchPools, branchSettings, inTransit, mainPool, period, remitHistory, remitRules } from "../mockData";
import { financeHref } from "../routes";
import type { InTransitRemit, MainPoolPosition, RemitRecord } from "../types";
import { LaterAction, NeedsEditNotice, Panel, PanelTitle } from "../ui";
import PoolFigures from "./PoolFigures";
import { overThreshold, remittable } from "./poolMath";

type TransitState = InTransitRemit & { disputed?: boolean };

/** 資金與繳回：教室的錢在哪、各小水庫、等確認的繳回、繳回規則與紀錄。 */
export default function Funds() {
  const canEdit = useCan("finance.edit");
  // 示意：確認收到、存進銀行都只改畫面上的數字。
  const [positions, setPositions] = useState<MainPoolPosition[]>(mainPool.positions);
  const [transit, setTransit] = useState<TransitState[]>(inTransit);
  const [history, setHistory] = useState<RemitRecord[]>(remitHistory);

  const mainTotal = positions.reduce((sum, p) => sum + p.amount, 0);
  const transitTotal = transit.reduce((sum, r) => sum + r.amount, 0);
  const total = mainTotal + branchPools.reduce((sum, p) => sum + p.balance, 0) + transitTotal;
  const directBranches = branchSettings.filter((s) => s.mode === "direct").map((s) => s.branch);
  const bankId = positions[0]?.id;

  const addToBank = (amount: number) =>
    setPositions((list) => list.map((p) => (p.id === bankId ? { ...p, amount: p.amount + amount } : p)));

  const deposit = (position: MainPoolPosition) => {
    setPositions((list) =>
      list.map((p) =>
        p.id === position.id ? { ...p, amount: 0 } : p.id === bankId ? { ...p, amount: p.amount + position.amount } : p
      )
    );
    toast.success(`（示意）已把 ${position.name} 存進銀行`);
  };

  const confirmReceived = (remit: TransitState) => {
    setTransit((list) => list.filter((r) => r.id !== remit.id));
    addToBank(remit.amount);
    setHistory((list) => list.map((r) => (r.id === remit.id ? { ...r, status: "confirmed" } : r)));
    toast.success("（示意）已確認收到");
  };

  const dispute = (remit: TransitState) => {
    setTransit((list) => list.map((r) => (r.id === remit.id ? { ...r, disputed: true } : r)));
    toast.success(`（示意）已退回給${remit.by}說明`);
  };

  const parts = [
    {
      key: "main",
      label: `大水庫${directBranches.length ? `（含${directBranches.join("、")}）` : ""}`,
      amount: mainTotal,
      bar: "bg-primary-300",
    },
    ...branchPools.map((p) => ({ key: p.id, label: p.name, amount: p.balance, bar: "bg-primary-500" })),
    { key: "transit", label: "轉帳中", amount: transitTotal, bar: "bg-warning-300" },
  ];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        title="資金與繳回"
        description={`大水庫 · ${mainPool.owner}／${mainPool.accountant}視角 · ${period.today}`}
        actions={
          <Button variant="secondary" asChild>
            <Link href={financeHref("fundSettings")}>據點設定</Link>
          </Button>
        }
      />

      <section aria-label="教室總資金" className="flex flex-col gap-4 rounded-2xl bg-primary-900 px-5 py-5 text-white lg:px-8 lg:py-7">
        <h3 className="text-base font-medium text-primary-100">教室的錢現在在哪裡</h3>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Figure label="總資金" value={total} className="font-bold" />
          {parts.map((part, i) => (
            <div key={part.key} className="contents">
              <span aria-hidden="true" className="pb-1 text-2xl text-primary-300">
                {i === 0 ? "＝" : "＋"}
              </span>
              <Figure
                label={part.label}
                value={part.amount}
                className={part.key === "transit" && part.amount > 0 ? "text-warning-300" : ""}
              />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-sm">
          {parts.map((part) => (
            <div key={part.key} className={part.bar} style={{ flex: `${part.amount} 1 0px` }} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {branchPools.map((pool) => {
          const alert = overThreshold(pool);
          return (
            <Link
              key={pool.id}
              href={financeHref("pool", pool.id)}
              className={cn(
                "flex flex-col gap-3.5 rounded-2xl border bg-white p-4 transition-colors hover:border-primary-700 lg:p-6",
                alert ? "border-warning-300" : "border-neutral-200"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-neutral-900">{pool.name}</div>
                  <div className="text-sm text-neutral-500">保管人 {pool.keeper}</div>
                </div>
                {alert ? <StatusTag tone="warning">建議繳回</StatusTag> : <StatusTag tone="positive">正常</StatusTag>}
              </div>
              <PoolFigures balance={pool.balance} reserve={pool.reserve} remittable={remittable(pool)} />
              <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 text-sm text-neutral-700">
                {pool.holders.map((h) => (
                  <div key={h.name} className="flex justify-between gap-3">
                    <span>
                      {h.name} 手上
                      {h.pending && <span className="text-warning-950"> · 還沒交給{pool.keeper}</span>}
                    </span>
                    <Money value={h.amount} />
                  </div>
                ))}
              </div>
              <div className="text-[13px] text-neutral-500">
                上次繳回 {pool.lastRemit.date} · <Money value={pool.lastRemit.amount} />
                {transit.some((r) => r.poolId === pool.id) && "（等確認）"}
              </div>
            </Link>
          );
        })}

        <Panel className="flex flex-col gap-3.5 p-4 lg:p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-neutral-900">大水庫</div>
              <div className="text-sm text-neutral-500">
                負責人 {mainPool.owner}
                {directBranches.length > 0 && ` · ${directBranches.join("、")}直接歸這裡`}
              </div>
            </div>
            {directBranches.length > 0 && <StatusTag tone="neutral">{directBranches.join("、")}免繳回</StatusTag>}
          </div>
          <div>
            <div className="text-[13px] text-neutral-500">合計</div>
            <Money value={mainTotal} className="text-[22px] font-semibold text-neutral-900" />
          </div>
          <div className="flex flex-col gap-1 border-t border-neutral-100 pt-3 text-sm text-neutral-700">
            {positions.map((p) => (
              <div key={p.id} className="flex min-h-9 items-center justify-between gap-2">
                <span>
                  {p.name}
                  {p.note && <span className="text-neutral-500"> · {p.note}</span>}
                </span>
                <span className="inline-flex items-center gap-2.5">
                  {canEdit && p.canDeposit && p.amount > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => deposit(p)}>
                      存進銀行
                    </Button>
                  )}
                  <Money value={p.amount} />
                </span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-neutral-500">這幾個位置之間移動不用送出或確認，只是記錄錢放在哪。</p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col gap-3.5 p-4 lg:p-6">
          <PanelTitle>等你確認收到</PanelTitle>
          {transit.length === 0 && <p className="text-sm text-neutral-500">沒有等確認的繳回。</p>}
          {transit.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-xl bg-warning-50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[15px] text-neutral-900">
                  <b>{r.from}</b> → 大水庫
                </div>
                <Money value={r.amount} className="text-[22px] font-semibold text-neutral-900" />
              </div>
              <div className="text-[13px] text-neutral-700">
                {r.by} · {r.at} · {r.method} · {r.ref}
              </div>
              {r.disputed ? (
                <p className="text-[13px] font-medium text-warning-950">已退回給{r.by}說明金額，等他回覆。</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <>
                      <Button onClick={() => confirmReceived(r)}>確認收到</Button>
                      <Button variant="secondary" onClick={() => dispute(r)}>
                        金額不符
                      </Button>
                    </>
                  )}
                  <LaterAction variant="ghost">看截圖</LaterAction>
                </div>
              )}
            </div>
          ))}
          {!canEdit && transit.length > 0 && <NeedsEditNotice action="確認收到" />}
          <p className="text-[13px] leading-relaxed text-neutral-500">
            確認之前，這筆錢顯示在「轉帳中」，小水庫和大水庫都不會重複算到。
          </p>
        </Panel>

        <RemitRulesCard canEdit={canEdit} />
      </div>

      <section aria-label="繳回紀錄" className="flex flex-col gap-3">
        <PanelTitle>繳回紀錄</PanelTitle>
        <DataView columns={HISTORY_COLUMNS} rows={history} rowKey={(r) => r.id} />
      </section>
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className="text-[13px] text-primary-100">{label}</div>
      <Money value={value} className={cn("text-2xl font-semibold lg:text-4xl", className)} />
    </div>
  );
}

function RemitRulesCard({ canEdit }: { canEdit: boolean }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(remitRules.map((r) => [r.id, r.enabled]))
  );

  return (
    <Panel className="flex flex-col gap-3 p-4 lg:p-6">
      <PanelTitle>繳回規則</PanelTitle>
      {remitRules.map((rule) => (
        <label
          key={rule.id}
          className={cn("flex items-start gap-3 text-[15px] leading-normal", canEdit ? "cursor-pointer" : "cursor-default")}
        >
          <input
            type="checkbox"
            checked={enabled[rule.id]}
            disabled={!canEdit}
            onChange={(e) => setEnabled((s) => ({ ...s, [rule.id]: e.target.checked }))}
            className="mt-0.5 size-5 shrink-0 accent-primary-900"
          />
          <span>
            <b className="text-neutral-900">{rule.title}</b>
            <br />
            <span className="text-[13px] text-neutral-500">{rule.note}</span>
          </span>
        </label>
      ))}
      <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
        {branchSettings.map((s) => (
          <div key={s.branch} className="flex flex-col gap-0.5">
            <span className="text-[13px] text-neutral-500">{s.mode === "pool" ? `${s.branch}零用金額度` : s.branch}</span>
            {s.mode === "pool" ? (
              <Money value={s.reserve} className="text-[15px] font-semibold text-neutral-900" />
            ) : (
              <span className="text-[15px] text-neutral-700">直接歸大水庫</span>
            )}
          </div>
        ))}
      </div>
      <Button variant="link" asChild className="self-start text-sm">
        <Link href={financeHref("fundSettings")}>{canEdit ? "到據點設定修改" : "看據點設定"}</Link>
      </Button>
    </Panel>
  );
}

const HISTORY_COLUMNS: DataViewColumn<RemitRecord>[] = [
  {
    key: "from",
    header: "從",
    width: "minmax(0,1.4fr)",
    role: "primary",
    render: (r) => <span className="block truncate text-sm text-neutral-900 lg:text-[15px]">{r.from}</span>,
  },
  { key: "date", header: "日期", width: "64px", render: (r) => <span className="tabular-nums">{r.date}</span> },
  { key: "method", header: "方式", width: "minmax(0,1fr)", render: (r) => <span className="truncate">{r.method}</span> },
  {
    key: "status",
    header: "狀態",
    width: "88px",
    render: (r) =>
      r.status === "in-transit" ? <StatusTag tone="warning">轉帳中</StatusTag> : <StatusTag tone="positive">已確認</StatusTag>,
  },
  {
    key: "amount",
    header: "金額",
    width: "96px",
    role: "trailing",
    render: (r) => <Money value={r.amount} className="ml-auto text-sm font-semibold text-neutral-900 lg:text-[15px]" />,
  },
];
