"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import Select from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import StatusTag from "@/components/StatusTag";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { calculateSplit, ROUND_UNITS, type RoundUnit } from "@/domains/finance/split";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import { EXPENSE_TEXT, moneyText } from "../Money";
import { dayLabel, rules } from "../mockData";
import type { SessionDraft, SplitRule } from "../types";
import { LabeledControl, LaterAction, NeedsEditNotice, Panel } from "../ui";

const UNIT_NAMES: Record<RoundUnit, string> = { 1: "個位", 10: "十位", 100: "百位" };
const MEMBER_BARS = ["bg-primary-500", "bg-primary-300", "bg-primary-400"];

const ruleLabel = (rule: SplitRule) =>
  `${rule.name} v${rule.version}${rule.effectiveFrom ? `（${rule.effectiveFrom} 起）` : ""}`;

/** 單一場次分帳試算：收入、場租、取整 → 每人分多少、流入水庫多少。 */
export default function SplitCalculator({ session }: { session: SessionDraft }) {
  const id = useId();
  const canEdit = useCan("finance.edit");
  const activeRules = rules.filter((r) => r.status === "active");
  const [ruleId, setRuleId] = useState(session.ruleId);
  const rule = activeRules.find((r) => r.id === ruleId) ?? activeRules[0];
  const [income, setIncome] = useState(String(session.income));
  const [rent, setRent] = useState(String(session.rent));
  const [roundUnit, setRoundUnit] = useState<RoundUnit>(rule.roundUnit);
  const [settled, setSettled] = useState(false);

  const members = session.members;
  const result = calculateSplit({
    income: Number(income) || 0,
    rent: Number(rent) || 0,
    poolRate: rule.poolRate,
    memberCount: members.length,
    roundUnit,
  });
  const ratePercent = Math.round(rule.poolRate * 100);

  const segments = [
    { key: "rent", label: "場租", amount: Math.min(result.rent, result.income), bar: "bg-warning-300" },
    { key: "pool", label: "水庫提撥", amount: result.pool, bar: "bg-primary-900" },
    ...members.map((m, i) => ({
      key: `member-${m.name}`,
      label: m.name,
      amount: result.perMemberRounded,
      bar: MEMBER_BARS[i % MEMBER_BARS.length],
    })),
    { key: "leftover", label: "零頭→水庫", amount: result.leftover, bar: "bg-primary-700" },
  ];

  const settle = () => {
    setSettled(true);
    toast.success("（示意）已結算");
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        title={`${session.title} · ${session.time}`}
        description={`課程場次 · ${dayLabel(session.day)}`}
        actions={
          <>
            {settled ? <StatusTag tone="positive">已結算</StatusTag> : <StatusTag tone="warning">待結算</StatusTag>}
            <StatusTag tone="neutral">{session.branch}</StatusTag>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
        <Panel className="p-4 lg:p-6">
          <fieldset disabled={settled} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={`${id}-income`}>點名收入</FieldLabel>
              <MoneyInput id={`${id}-income`} value={income} onChange={setIncome} size="lg" />
              <p className="text-[13px] text-neutral-500">現在先手動輸入；之後由點名自動帶入</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={`${id}-rent`}>場租</FieldLabel>
              <MoneyInput id={`${id}-rent`} value={rent} onChange={setRent} />
            </div>

            <LabeledControl label="套用規則" htmlFor={`${id}-rule`}>
              <Select
                id={`${id}-rule`}
                value={rule.id}
                onChange={(ruleId) => {
                  const next = activeRules.find((r) => r.id === ruleId);
                  if (!next) return;
                  setRuleId(next.id);
                  setRoundUnit(next.roundUnit);
                }}
                options={activeRules.map((r) => ({ value: r.id, label: ruleLabel(r) }))}
              />
            </LabeledControl>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-900">授課成員</span>
              <div className="flex flex-wrap items-center gap-2">
                {members.map((m) => (
                  <span
                    key={m.name}
                    className="inline-flex items-center gap-2 rounded-full bg-primary-50 py-1.5 pl-1.5 pr-3 text-sm text-neutral-900"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex size-7 items-center justify-center rounded-full bg-primary-100 text-[13px] font-semibold text-primary-900"
                    >
                      {m.name.slice(-1)}
                    </span>
                    {m.name} · {m.role}
                  </span>
                ))}
                <LaterAction variant="ghost" size="sm">
                  <Plus className="size-4" />
                  成員
                </LaterAction>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-900">取整單位（規格待決定，可在這裡比較）</span>
              <SegmentedTabs
                ariaLabel="取整單位"
                fill
                value={String(roundUnit)}
                onChange={(v) => setRoundUnit(Number(v) as RoundUnit)}
                options={ROUND_UNITS.map((u) => ({ value: String(u), label: `捨去到 ${u}` }))}
              />
            </div>
          </fieldset>
        </Panel>

        <Panel className="flex min-w-0 flex-col gap-5 p-4 lg:px-7 lg:py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-neutral-900">分帳試算</h3>
            <span className="text-[13px] text-neutral-500">輸入即時更新</span>
          </div>

          <div aria-hidden="true" className="flex h-10 gap-0.5 overflow-hidden rounded-lg bg-neutral-100">
            {segments.map((s) => (
              <div key={s.key} className={s.bar} style={{ flex: `${Math.max(0, s.amount)} 1 0px` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-neutral-700">
            {segments.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", s.bar)} />
                {s.label} <b className="tabular-nums">{moneyText(s.amount)}</b>
              </span>
            ))}
          </div>

          <ol className="flex flex-col border-t border-neutral-100">
            <Step marker="1" label="點名收入" value={moneyText(result.income)} />
            <Step marker="2" label="扣除場租" value={moneyText(-result.rent)} valueClass={EXPENSE_TEXT} />
            <Step marker="＝" label="可分配金額" value={moneyText(result.distributable)} highlight />
            <Step
              marker="3"
              label={`提撥進水庫 ${ratePercent}%`}
              detail={`${moneyText(result.distributable)} × ${ratePercent}%`}
              value={`→ 水庫 ${moneyText(result.pool)}`}
              valueClass="text-primary-900"
            />
            <Step
              marker="4"
              label={`剩餘平分給 ${members.length} 位老師`}
              detail={`${moneyText(result.remaining)} ÷ ${members.length} = ${moneyText(result.perMember)}`}
              value={moneyText(result.perMember)}
            />
            <Step
              marker="5"
              label={`無條件捨去到${UNIT_NAMES[roundUnit]}`}
              detail={`${moneyText(result.perMember)} → ${moneyText(result.perMemberRounded)}，零頭 ${moneyText(result.leftover)} 歸水庫`}
              value={`→ 水庫 ${moneyText(result.leftover)}`}
              valueClass="text-primary-900"
            />
          </ol>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {members.map((m) => (
              <div key={m.name} className="rounded-xl bg-primary-50 p-4">
                <div className="text-sm text-neutral-700">{m.name}</div>
                <div className="text-2xl font-semibold tabular-nums text-neutral-900 lg:text-[28px]">
                  {moneyText(result.perMemberRounded)}
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-primary-900 p-4 text-white">
              <div className="text-sm text-primary-100">流入水庫合計</div>
              <div className="text-2xl font-semibold tabular-nums lg:text-[28px]">{moneyText(result.toTank)}</div>
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                disabled={settled}
                onClick={() => toast.success("（示意）已存為草稿")}
              >
                存為草稿
              </Button>
              <Button disabled={settled} onClick={settle}>
                {settled ? "已結算" : "確認結算"}
              </Button>
            </div>
          ) : (
            <NeedsEditNotice action="結算場次" className="justify-end" />
          )}
        </Panel>
      </div>
    </div>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  size = "md",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn(fieldControlClass(), "flex items-center gap-2", size === "lg" ? "h-16" : "h-12")}>
      <span className="text-base text-neutral-500">NT$</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full min-w-0 bg-transparent font-semibold tabular-nums text-neutral-900 outline-none disabled:text-neutral-500",
          size === "lg" ? "text-3xl" : "text-xl"
        )}
      />
    </div>
  );
}

function Step({
  marker,
  label,
  detail,
  value,
  valueClass,
  highlight = false,
}: {
  marker: string;
  label: string;
  detail?: ReactNode;
  value: string;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-neutral-100 px-1 py-3.5",
        highlight && "bg-neutral-50"
      )}
    >
      <span className="tabular-nums text-neutral-500">{marker}</span>
      <div className="min-w-0">
        <div className={cn("text-[15px] text-neutral-900", highlight && "font-medium")}>{label}</div>
        {detail && <div className="text-[13px] tabular-nums text-neutral-500">{detail}</div>}
      </div>
      <span className={cn("text-base tabular-nums text-neutral-900 lg:text-lg", highlight && "font-semibold", valueClass)}>
        {value}
      </span>
    </li>
  );
}
