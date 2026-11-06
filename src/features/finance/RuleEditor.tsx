"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import Select from "@/components/Select";
import Drawer from "@/components/Drawer";
import InfoTip from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import type { Payee } from "@/domains/finance/types";
import { formatMoney } from "@/lib/money";
import {
  hasVenuePack,
  payeeFromKey,
  payeeKey,
  remainingBeforeRow,
  shareText,
  validateRows,
  type RuleRow,
} from "./ruleEditorModel";
import type { SplitNames } from "./useSplitNames";

/** 數字輸入：自己留著字串，輸入「33.」「0.5」時才不會被吃掉。 */
function NumInput({
  value,
  onChange,
  suffix,
  prefix,
  label,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  prefix?: string;
  label: string;
  max?: number;
}) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  const shown = Number(text) === value || (text === "" && value === 0) ? text : String(Math.round(value * 100) / 100);
  return (
    <div className={cn(fieldControlClass(), "flex h-11 items-center gap-1 px-3 w-28 shrink-0")}>
      {prefix && <span className="text-neutral-500">{prefix}</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        className="min-w-0 flex-1 bg-transparent outline-none"
        value={shown}
        onChange={(e) => {
          const t = e.target.value;
          if (!/^\d*\.?\d{0,2}$/.test(t)) return;
          setText(t);
          const n = t === "" || t === "." ? 0 : Number(t);
          onChange(max !== undefined ? Math.min(n, max) : n);
        }}
      />
      {suffix && <span className="text-neutral-500">{suffix}</span>}
    </div>
  );
}

const BASE_OPTIONS = [
  { value: "income", label: "這堂收入的" },
  { value: "remaining", label: "前面扣完剩下的" },
] as const;

/** 用一堂真實的收入示範「前面扣完剩下的」是多少。 */
export type RuleSample = { income: number; packUnit: number; label: string };

export default function RuleEditor({
  rows,
  onChange,
  names,
  sample,
}: {
  rows: RuleRow[];
  onChange: (rows: RuleRow[]) => void;
  names: SplitNames;
  sample?: RuleSample;
}) {
  const lines = rows.slice(0, -1);
  const rest = rows[rows.length - 1];

  const basePayeeOptions = [
    ...names.teachers.map((t) => ({ value: `t:${t.id}`, label: t.name, hint: "老師" })),
    ...names.locations.map((l) => ({ value: `f:${l.id}`, label: `${l.name}公積金` })),
    ...names.venues.map((v) => ({ value: `v:${v.id}`, label: names.venueLabel(v.id), hint: "場地" })),
  ];
  // 規則裡已經封存的對象也要留在選項裡，不然下拉會顯示空白
  const payeeOptions = (current: Payee) => {
    const key = payeeKey(current);
    return basePayeeOptions.some((o) => o.value === key)
      ? basePayeeOptions
      : [...basePayeeOptions, { value: key, label: `${names.payee(current)}（已封存）`, hint: undefined }];
  };
  const withCurrent = (opts: { value: number; label: string }[], id: number) =>
    opts.some((o) => o.value === id) ? opts : [...opts, { value: id, label: `${names.location(id)}公積金（已封存）` }];
  const locationOptions = names.locations.map((l) => ({ value: l.id, label: `${l.name}公積金` }));
  const defaultFund = locationOptions[0]?.value ?? 0;
  const firstPayee: Payee = names.teachers[0]
    ? { type: "teacher", teacherId: names.teachers[0].id }
    : { type: "fund", locationId: defaultFund };

  const setLines = (next: RuleRow[]) => onChange([...next, rest]);
  const update = (i: number, row: RuleRow) => setLines(lines.map((r, j) => (j === i ? row : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...lines];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setLines(next);
  };

  const payeeSelect = (p: Payee, set: (p: Payee) => void) => (
    <Select
      size="sm"
      aria-label="給誰"
      className="min-w-0 flex-1"
      value={payeeKey(p)}
      options={payeeOptions(p)}
      onChange={(k) => set(payeeFromKey(k, p))}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 text-sm font-medium text-neutral-900">
        由上往下扣
        <InfoTip label="分帳規則說明">
          每一行從這堂收入裡扣一筆，最後「剩下的」給剩下的人。收入不夠時，老師拿 0，差額由這堂課的基金吸收。
        </InfoTip>
      </div>

      {lines.map((row, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-medium text-neutral-700">
              {row.type === "fixed" ? "固定金額" : row.type === "venuePack" ? "場地次數包" : "比例"}
            </div>
            <Button variant="ghost" size="iconSm" aria-label="上移" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="下移"
              disabled={i === lines.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="刪除這一行"
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </Button>
          </div>

          {row.type === "fixed" && (
            <div className="flex items-center gap-2">
              <NumInput label="金額" prefix="$" value={row.amount} onChange={(amount) => update(i, { ...row, amount })} />
              <span className="text-neutral-500">→</span>
              {payeeSelect(row.to, (to) => update(i, { ...row, to }))}
            </div>
          )}

          {(row.type === "percentIncome" || row.type === "percentRemaining") && (
            <>
              <div className="flex items-center gap-2">
                <NumInput
                  label="比例"
                  suffix="%"
                  max={100}
                  value={row.pct}
                  onChange={(pct) => update(i, { ...row, pct })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="三分之一"
                  onClick={() => update(i, { ...row, pct: 100 / 3 })}
                >
                  ⅓
                </Button>
                <Select
                  size="sm"
                  aria-label="比例的基準"
                  className="min-w-0 flex-1"
                  value={row.type === "percentIncome" ? "income" : "remaining"}
                  options={[...BASE_OPTIONS]}
                  onChange={(base) =>
                    update(i, { type: base === "income" ? "percentIncome" : "percentRemaining", pct: row.pct, to: row.to })
                  }
                />
              </div>
              {row.type === "percentRemaining" && sample && (() => {
                const { deducted, remaining } = remainingBeforeRow(rows, i, sample.income, sample.packUnit);
                return (
                  <p className="text-[13px] text-neutral-500">
                    以{sample.label}為例：${formatMoney(sample.income)}
                    {deducted > 0 ? ` − $${formatMoney(deducted)}（上面幾行）` : ""} ＝ ${formatMoney(remaining)}，再取 {Math.round(row.pct * 100) / 100}%
                  </p>
                );
              })()}
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">→</span>
                {payeeSelect(row.to, (to) => update(i, { ...row, to }))}
              </div>
            </>
          )}

          {row.type === "venuePack" && (
            <Select
              size="sm"
              aria-label="場地"
              value={row.venueId}
              options={(names.venues.some((v) => v.id === row.venueId) ? names.venues.map((v) => v.id) : [...names.venues.map((v) => v.id), row.venueId]).map((id) => ({ value: id, label: names.venueLabel(id) }))}
              onChange={(venueId) => update(i, { type: "venuePack", venueId })}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLines([...lines, { type: "fixed", amount: 0, to: firstPayee }])}
        >
          + 固定金額
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLines([...lines, { type: "percentIncome", pct: 0, to: firstPayee }])}
        >
          + 比例
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={hasVenuePack(rows) || names.venues.length === 0}
          onClick={() => setLines([...lines, { type: "venuePack", venueId: names.venues[0].id }])}
        >
          + 場地次數包
        </Button>
      </div>

      {rest.type === "rest" && (
        <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-3">
          <div className="text-sm font-medium text-neutral-900">剩下的</div>
          <Select
            size="sm"
            aria-label="剩下的給誰"
            value={rest.rest.type}
            options={[
              { value: "teachers", label: "老師" },
              { value: "fund", label: "公積金" },
            ]}
            onChange={(type) =>
              onChange([
                ...lines,
                {
                  ...rest,
                  rest:
                    type === "fund"
                      ? { type: "fund", locationId: rest.fundLocationId }
                      : { type: "teachers", shares: names.teachers[0] ? [{ teacherId: names.teachers[0].id, weight: 1 }] : [] },
                },
              ])
            }
          />
          {rest.rest.type === "fund" ? (
            <Select
              size="sm"
              aria-label="哪個公積金"
              value={rest.rest.locationId}
              options={withCurrent(locationOptions, rest.rest.locationId)}
              onChange={(locationId) => onChange([...lines, { ...rest, rest: { type: "fund", locationId } }])}
            />
          ) : (
            <TeacherShares
              names={names}
              shares={rest.rest.shares}
              onChange={(shares) => onChange([...lines, { ...rest, rest: { type: "teachers", shares } }])}
            />
          )}
          <div className="mt-1 flex items-center gap-1 text-sm text-neutral-700">
            這堂課的基金
            <InfoTip label="這堂課的基金說明">公積金比例和不夠付的差額都算在這個分部的公積金。預設是課程所在的分部。</InfoTip>
          </div>
          <Select
            size="sm"
            aria-label="這堂課的基金"
            value={rest.fundLocationId}
            options={withCurrent(locationOptions, rest.fundLocationId)}
            onChange={(fundLocationId) => onChange([...lines, { ...rest, fundLocationId }])}
          />
        </div>
      )}
    </div>
  );
}

/** 「剩下的」給哪幾位老師：勾選＋權重（預設 1 = 平分）。 */
function TeacherShares({
  names,
  shares,
  onChange,
}: {
  names: SplitNames;
  shares: { teacherId: number; weight: number }[];
  onChange: (shares: { teacherId: number; weight: number }[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {names.teachers.map((t) => {
        const share = shares.find((s) => s.teacherId === t.id);
        return (
          <div key={t.id} className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={!!share}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...shares, { teacherId: t.id, weight: 1 }] : shares.filter((s) => s.teacherId !== t.id)
                  )
                }
              />
              {t.name}
            </label>
            {share && shares.length > 1 && (
              <div className="flex items-center gap-1 text-[13px] text-neutral-500">
                比重
                <NumInput
                  label={`${t.name}的比重`}
                  value={share.weight}
                  onChange={(weight) =>
                    onChange(shares.map((s) => (s.teacherId === t.id ? { ...s, weight } : s)))
                  }
                />
                <span className="w-12 shrink-0 tabular-nums">（{shareText(share.weight, shares)}）</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RuleEditorDrawer({
  open,
  title,
  subtitle,
  scopeNote,
  sample,
  initialRows,
  names,
  isLoading,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** 編輯器最上面一行：這次改會影響哪些課。 */
  scopeNote?: string;
  sample?: RuleSample;
  initialRows: RuleRow[];
  names: SplitNames;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (rows: RuleRow[]) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const error = validateRows(rows);
  return (
    <Drawer
      open={open}
      title={title}
      subtitle={subtitle}
      submitText="儲存"
      isLoading={isLoading}
      disabled={!!error}
      onClose={onClose}
      onSubmit={() => onSave(rows)}
    >
      {scopeNote && <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700">{scopeNote}</p>}
      <RuleEditor rows={rows} onChange={setRows} names={names} sample={sample} />
      {error && <p className="mt-2 text-[13px] text-danger-700">{error}</p>}
    </Drawer>
  );
}
