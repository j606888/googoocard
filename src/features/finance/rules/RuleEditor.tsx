"use client";

import { Fragment, useId, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { calculateSplit, ROUND_UNITS, type RoundUnit } from "@/domains/finance/split";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import { moneyText } from "../Money";
import { EDITING_RULE_ID, ROLE_OPTIONS, period, ruleAllocations, ruleVersions, rules } from "../mockData";
import type { AllocationMethod, RuleAllocation, RuleVersion, SplitRule } from "../types";
import { LabeledControl, LaterAction, NeedsEditNotice, Panel, PanelTitle } from "../ui";

const METHODS: AllocationMethod[] = ["份數", "百分比", "固定金額"];
/** 規則頁的範例試算用這一堂。 */
const EXAMPLE = { income: 2000, rent: 250 };

const ruleMeta = (rule: SplitRule) =>
  rule.status === "draft" ? `草稿 · ${rule.draftNote ?? ""}` : `v${rule.version} · 使用中 · ${rule.sessionCount ?? 0} 個場次`;

const allocationText = (a: RuleAllocation) =>
  a.method === "份數" ? `${a.role} ${a.value} 份` : a.method === "百分比" ? `${a.role} ${a.value}%` : `${a.role} ${moneyText(Number(a.value) || 0)} 元`;

const isoToSlash = (iso: string) => iso.replaceAll("-", "/");

/** 分帳規則：規則列表、錢怎麼流、分配對象、取整、版本紀錄。 */
export default function RuleEditor() {
  const id = useId();
  const canEdit = useCan("finance.edit");
  const rule = rules.find((r) => r.id === EDITING_RULE_ID) ?? rules[0];

  const [allocations, setAllocations] = useState<RuleAllocation[]>(ruleAllocations);
  const [roundUnit, setRoundUnit] = useState<RoundUnit>(rule.roundUnit);
  const [effectiveFrom, setEffectiveFrom] = useState(period.nextMonthFirstISO);
  const [versions, setVersions] = useState<RuleVersion[]>(ruleVersions);

  const latestVersion = Math.max(rule.version, ...versions.map((v) => v.version));
  const nextVersion = latestVersion + 1;
  /** 已經生效的最新版本；發布了但還沒到生效日的是「已排定」。 */
  const inUse = Math.max(0, ...versions.filter((v) => v.effectiveFrom <= period.today).map((v) => v.version));
  const ratePercent = Math.round(rule.poolRate * 100);
  const required = allocations.filter((a) => !a.optional);
  const example = calculateSplit({ ...EXAMPLE, poolRate: rule.poolRate, memberCount: required.length, roundUnit });

  const updateAllocation = (allocationId: string, patch: Partial<RuleAllocation>) =>
    setAllocations((list) => list.map((a) => (a.id === allocationId ? { ...a, ...patch } : a)));

  const addRole = () =>
    setAllocations((list) => [...list, { id: `new-${Date.now()}`, role: ROLE_OPTIONS[0], method: "份數", value: "1" }]);

  const publish = () => {
    if (!effectiveFrom) return;
    setVersions((list) => [
      ...list,
      { version: nextVersion, effectiveFrom: isoToSlash(effectiveFrom), note: `（示意）捨去到 ${roundUnit}、${required.length} 位分配` },
    ]);
    toast.success(`（示意）已發布 v${nextVersion}`);
  };

  const flow = [
    { key: "income", step: "① 收入", title: "點名收入", note: "課卡扣堂＋單堂", tone: "plain" as const },
    { key: "deduct", step: "② 扣除", title: "場租", note: "依場次實際金額", tone: "expense" as const },
    { key: "tank", step: "③ 水庫", title: `${ratePercent}%`, note: "提撥可分配金額", tone: "tank" as const },
    {
      key: "split",
      step: "④ 分配",
      title: "依份數平分",
      note: required.map(allocationText).join(" · ") || "還沒有分配對象",
      tone: "water" as const,
    },
    { key: "round", step: "⑤ 取整", title: `捨去到 ${roundUnit}`, note: "零頭 → 水庫", tone: "plain" as const },
  ];

  const flowTone = {
    plain: { box: "bg-neutral-50", step: "text-neutral-500", note: "text-neutral-500", title: "text-neutral-900" },
    expense: { box: "bg-warning-50", step: "text-warning-950", note: "text-warning-950", title: "text-neutral-900" },
    tank: { box: "bg-primary-900", step: "text-primary-100", note: "text-primary-100", title: "text-white" },
    water: { box: "bg-primary-50", step: "text-primary-900", note: "text-primary-900", title: "text-neutral-900" },
  };

  const select = cn(fieldControlClass(), "h-11 px-3 text-[15px]");

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader title="分帳規則" description="每堂課的錢怎麼分：扣場租、提撥水庫、分給老師、取整" />

      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <section aria-label="規則列表" className="flex flex-col gap-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <PanelTitle>規則</PanelTitle>
            {canEdit && (
              <LaterAction variant="ghost" size="sm">
                <Plus className="size-4" />
                新增規則
              </LaterAction>
            )}
          </div>
          {rules.map((r) => {
            const editing = r.id === rule.id;
            return (
              <div
                key={r.id}
                aria-current={editing ? "true" : undefined}
                className={cn(
                  "rounded-xl px-4 py-3",
                  editing
                    ? "border border-primary-700 bg-white ring-1 ring-primary-700"
                    : r.status === "draft"
                      ? "border-[1.5px] border-dashed border-neutral-300 bg-neutral-50"
                      : "border border-neutral-200 bg-white"
                )}
              >
                <div className={cn("text-[15px] text-neutral-900", editing ? "font-bold" : "font-medium")}>{r.name}</div>
                <div className={cn("mt-0.5 text-[13px]", r.status === "draft" ? "text-warning-950" : "text-neutral-500")}>
                  {ruleMeta(r)}
                </div>
              </div>
            );
          })}
        </section>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col items-start gap-2">
              <StatusTag tone="outline">
                v{latestVersion} · 編輯中將建立 v{nextVersion}
              </StatusTag>
              <h3 className="text-2xl font-bold text-neutral-900">{rule.name}</h3>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-end gap-3">
                <LabeledControl label="新版本生效日" htmlFor={`${id}-from`}>
                  <input
                    id={`${id}-from`}
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className={cn(fieldControlClass(), "h-11 px-3 text-[15px]")}
                  />
                </LabeledControl>
                <Button onClick={publish} disabled={!effectiveFrom}>
                  發布 v{nextVersion}
                </Button>
              </div>
            ) : (
              <NeedsEditNotice action="修改分帳規則" />
            )}
          </header>

          <Panel className="flex flex-col gap-4 p-4 lg:p-6">
            <PanelTitle>錢怎麼流</PanelTitle>
            <div className="flex flex-col items-stretch gap-2 lg:flex-row">
              {flow.map((s, i) => {
                const tone = flowTone[s.tone];
                return (
                  <Fragment key={s.key}>
                    {i > 0 && (
                      <div aria-hidden="true" className="flex items-center justify-center text-neutral-400">
                        <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
                      </div>
                    )}
                    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl p-4 lg:flex-1", tone.box)}>
                      <div className={cn("text-xs font-semibold tracking-[0.08em]", tone.step)}>{s.step}</div>
                      <div
                        className={cn(
                          s.tone === "tank" ? "text-[28px] font-semibold tabular-nums" : "text-base font-bold",
                          tone.title
                        )}
                      >
                        {s.title}
                      </div>
                      <div className={cn("text-[13px]", tone.note)}>{s.note}</div>
                      {s.key === "deduct" && canEdit && (
                        <LaterAction variant="ghost" size="sm" className="mt-1 self-start">
                          <Plus className="size-4" />
                          扣除項
                        </LaterAction>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            <Panel className="flex flex-col gap-3 p-4 lg:p-6">
              <PanelTitle>④ 分配對象（角色與權重）</PanelTitle>
              <p className="text-[13px] text-neutral-500">規則只定義角色，實際是誰由每個場次指定。</p>
              <fieldset disabled={!canEdit} className="flex flex-col gap-2">
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_64px] gap-2 pt-1 text-[13px] font-medium text-neutral-500">
                  <span>角色</span>
                  <span>權重方式</span>
                  <span>值</span>
                </div>
                {allocations.map((a) => (
                  <div
                    key={a.id}
                    className={cn("grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_64px] items-center gap-2", a.optional && "opacity-75")}
                  >
                    <select
                      aria-label="角色"
                      value={a.role}
                      onChange={(e) => updateAllocation(a.id, { role: e.target.value })}
                      className={select}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                    <select
                      aria-label="權重方式"
                      value={a.method}
                      onChange={(e) => updateAllocation(a.id, { method: e.target.value as AllocationMethod })}
                      className={select}
                    >
                      {METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <input
                      aria-label="值"
                      inputMode="numeric"
                      value={a.value}
                      onChange={(e) => updateAllocation(a.id, { value: e.target.value })}
                      className={cn(select, "tabular-nums")}
                    />
                  </div>
                ))}
              </fieldset>
              {canEdit && (
                <Button variant="ghost" size="sm" className="self-start" onClick={addRole}>
                  <Plus className="size-4" />
                  新增角色
                </Button>
              )}
            </Panel>

            <Panel className="flex flex-col gap-3.5 p-4 lg:p-6">
              <PanelTitle>⑤ 取整規則</PanelTitle>
              <fieldset disabled={!canEdit} className="flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <LabeledControl label="單位" htmlFor={`${id}-unit`}>
                    <select
                      id={`${id}-unit`}
                      value={roundUnit}
                      onChange={(e) => setRoundUnit(Number(e.target.value) as RoundUnit)}
                      className={select}
                    >
                      {ROUND_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u} 元
                        </option>
                      ))}
                    </select>
                  </LabeledControl>
                  <LabeledControl label="方式" htmlFor={`${id}-mode`}>
                    <select id={`${id}-mode`} defaultValue="floor" className={select}>
                      <option value="floor">無條件捨去</option>
                      <option value="round" disabled>
                        四捨五入（之後）
                      </option>
                    </select>
                  </LabeledControl>
                </div>
                <LabeledControl label="零頭歸屬" htmlFor={`${id}-leftover`}>
                  <select id={`${id}-leftover`} className={select}>
                    <option>水庫</option>
                  </select>
                </LabeledControl>
              </fieldset>
              <div className="rounded-xl bg-neutral-50 px-4 py-3.5 text-sm leading-8 text-neutral-900">
                <div className="text-[13px] text-neutral-500">
                  用範例試算：收入 {moneyText(EXAMPLE.income)}、場租 {moneyText(EXAMPLE.rent)}、{required.length} 位平分
                </div>
                <div className="tabular-nums">
                  {moneyText(example.distributable)} × {ratePercent}% = {moneyText(example.pool)} → 水庫
                </div>
                <div className="tabular-nums">
                  {moneyText(example.remaining)} ÷ {required.length} = {moneyText(example.perMember)} → 每人{" "}
                  {moneyText(example.perMemberRounded)}
                </div>
                <div className="tabular-nums">
                  零頭 {moneyText(example.leftover)} → 水庫 · 水庫合計 {moneyText(example.toTank)}
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="p-4 lg:p-6">
            <PanelTitle className="mb-3">版本紀錄</PanelTitle>
            <div className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {versions.map((v) => {
                const current = v.version === inUse;
                const scheduled = v.effectiveFrom > period.today;
                return (
                  <div key={v.version} className={cn("rounded-xl px-3.5 py-3", current ? "bg-primary-50" : "bg-neutral-50")}>
                    <div className="text-sm font-bold text-neutral-900">
                      v{v.version} · {v.effectiveFrom}
                      {current && " · 使用中"}
                      {scheduled && " · 已排定"}
                    </div>
                    <div className={cn("mt-1 text-[13px]", current ? "text-primary-900" : "text-neutral-500")}>{v.note}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-neutral-500">舊場次永遠用當時的版本計算，發布新版本不會改到已結算的帳。</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
