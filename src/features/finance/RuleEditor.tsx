"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, X } from "lucide-react";
import Menu from "@/components/Menu";
import Select, { type SelectOption } from "@/components/Select";
import PayeePicker from "./PayeePicker";
import Drawer from "@/components/Drawer";
import InfoTip from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import type { Payee } from "@/domains/finance/types";
import { formatMoney } from "@/lib/money";
import {
  checkRule,
  hasVenuePack,
  newPercentRow,
  PCT_PRESETS,
  payeeFromKey,
  previewSplit,
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
  scopeNote,
  lessonTeacherIds = [],
  lessonLocationId = null,
  status,
}: {
  /** 試算下面的狀態列（錯誤／checkRule）；電腦版跟試算一起釘在右欄。 */
  status?: React.ReactNode;
  rows: RuleRow[];
  onChange: (rows: RuleRow[]) => void;
  names: SplitNames;
  sample?: RuleSample;
  /** 這次改會影響哪些課；收在標題旁的 ⓘ。 */
  scopeNote?: string;
  /** 這門課的老師：「剩下的」切到老師時預設全勾、平分。 */
  lessonTeacherIds?: number[];
  /** 課程標的分部：收入、老師、場地都記在這裡；預設的場地與公積金從這個分部挑。 */
  lessonLocationId?: number | null;
}) {
  const lines = rows.slice(0, -1);
  const rest = rows[rows.length - 1];

  // 公積金只能選這門課的分部（2026-11-10）；課沒標分部才列全部
  const fundLocations = lessonLocationId === null ? names.locations : names.locations.filter((l) => l.id === lessonLocationId);
  // 一個下拉、三組標題：老師／公積金／場地
  const payeeGroups: { type: Payee["type"]; group: string; options: SelectOption<string>[] }[] = [
    { type: "teacher", group: "老師", options: names.teachers.map((t) => ({ value: `t:${t.id}`, label: t.name })) },
    { type: "fund", group: "公積金", options: fundLocations.map((l) => ({ value: `f:${l.id}`, label: `${l.name}公積金` })) },
    { type: "venue", group: "場地", options: names.venues.map((v) => ({ value: `v:${v.id}`, label: names.venueLabel(v.id) })) },
  ];
  // 規則裡已經封存的對象也要留在選項裡（放進它那一組），不然下拉會顯示空白
  const payeeOptions = (current: Payee): SelectOption<string>[] => {
    const key = payeeKey(current);
    const missing = !payeeGroups.some((g) => g.options.some((o) => o.value === key));
    return payeeGroups.flatMap(({ type, group, options }) => [
      ...options,
      ...(missing && current.type === type ? [{ value: key, label: `${names.payee(current)}（${current.type === "fund" && names.locations.some((l) => l.id === current.locationId) ? "別的分部，請改掉" : "已封存"}）` }] : []),
    ].map((o) => ({ ...o, group })));
  };
  const withCurrent = (opts: { value: number; label: string }[], id: number) =>
    opts.some((o) => o.value === id)
      ? opts
      : [...opts, { value: id, label: `${names.location(id)}公積金（${names.locations.some((l) => l.id === id) ? "別的分部，請改掉" : "已封存"}）` }];
  const locationOptions = fundLocations.map((l) => ({ value: l.id, label: `${l.name}公積金` }));
  const defaultFund = lessonLocationId ?? locationOptions[0]?.value ?? 0;
  // 「＋場地費」先挑這門課分部的場地
  const defaultVenue = names.venues.find((v) => v.locationId === lessonLocationId) ?? names.venues[0];
  const lessonTeachers = lessonTeacherIds.map((id) => names.teacher(id)).filter(Boolean);
  // 規則裡用到別的分部的場地（可以，但提醒）或公積金（不行，存不了）
  const otherVenues = lessonLocationId === null ? [] : rows.flatMap((r) => {
    if (r.type !== "venuePack") return [];
    const v = names.venues.find((x) => x.id === r.venueId);
    return v && v.locationId !== null && v.locationId !== lessonLocationId ? [names.venueLabel(v.id)] : [];
  });
  const otherFund = lessonLocationId !== null && rows.some((r) =>
    r.type === "rest"
      ? r.rest.type === "fund" && r.rest.locationId !== lessonLocationId
      : r.type !== "venuePack" && r.to.type === "fund" && r.to.locationId !== lessonLocationId,
  );

  const firstPayee: Payee = names.teachers[0]
    ? { type: "teacher", teacherId: names.teachers[0].id }
    : { type: "fund", locationId: defaultFund };

  const setLines = (next: RuleRow[]) => onChange([...next, rest]);
  // 切到「老師」：這門課的老師全勾、比重 1（平分）；課沒掛老師才退回第一位
  const defaultShares = () => {
    const ids = lessonTeacherIds.filter((id) => names.teachers.some((t) => t.id === id));
    if (ids.length > 0) return ids.map((teacherId) => ({ teacherId, weight: 1 }));
    return names.teachers[0] ? [{ teacherId: names.teachers[0].id, weight: 1 }] : [];
  };
  const update = (i: number, row: RuleRow) => setLines(lines.map((r, j) => (j === i ? row : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...lines];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setLines(next);
  };

  const payeeSelect = (p: Payee, set: (p: Payee) => void) => (
    <PayeePicker
      aria-label="給誰"
      className="min-w-0 flex-1"
      value={payeeKey(p)}
      options={payeeOptions(p)}
      onChange={(k) => set(payeeFromKey(k, p))}
    />
  );

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 text-sm font-medium text-neutral-900">
        這堂課的課卡收入，由上往下扣：
        <InfoTip label="分帳規則說明">
          {scopeNote && <p className="mb-2">{scopeNote}</p>}
          每一行從這堂收入裡扣一筆，最後一行「扣完剩下的」給老師或公積金。收入不夠扣時，老師拿 0，差額由公積金吸收（見最後一行下方）。
        </InfoTip>
      </div>
      {lessonTeachers.length > 0 && (
        <p className="-mt-1 text-[13px] text-neutral-500">這門課的老師：{lessonTeachers.join("、")}</p>
      )}
      {otherFund && (
        <p className="flex items-start gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>這門課在{names.location(lessonLocationId!)}，公積金只能選{names.location(lessonLocationId!)}公積金，請改掉標「別的分部」的那一行。</span>
        </p>
      )}
      {otherVenues.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {[...new Set(otherVenues)].join("、")}是別的分部的場地；這門課在{names.location(lessonLocationId!)}，場地費會記在{names.location(lessonLocationId!)}。確定沒選錯再存檔。
          </span>
        </p>
      )}

      {lines.map((row, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-medium text-neutral-700">
              {row.type === "fixed" ? "固定金額" : row.type === "venuePack" ? "場地費" : "比例"}
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
                <PctPresets onPick={(pct) => update(i, { ...row, pct })} />
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
            <>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">→</span>
                <Select
                  size="sm"
                  aria-label="場地"
                  className="min-w-0 flex-1"
                  value={row.venueId}
                  options={(names.venues.some((v) => v.id === row.venueId) ? names.venues.map((v) => v.id) : [...names.venues.map((v) => v.id), row.venueId]).map((id) => ({ value: id, label: names.venueLabel(id) }))}
                  onChange={(venueId) => update(i, { type: "venuePack", venueId })}
                />
              </div>
              <p className="text-[13px] text-neutral-500">
                {(() => {
                  const unit = names.venueUnit(row.venueId);
                  return unit === null
                    ? "金額照場地的收費方式；這個場地還沒設定每次多少或次數包"
                    : `金額照場地的收費方式：目前每次 $${formatMoney(unit)}`;
                })()}
              </p>
            </>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLines([...lines, { type: "fixed", amount: 0, to: firstPayee }])}
        >
          ＋固定金額
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLines([...lines, newPercentRow(lines.length, firstPayee)])}
        >
          ＋比例
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={hasVenuePack(rows) || names.venues.length === 0}
          onClick={() => setLines([...lines, { type: "venuePack", venueId: defaultVenue.id }])}
        >
          ＋場地費
        </Button>
      </div>

      {rest.type === "rest" && (
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
          <div className="text-sm font-medium text-neutral-700">這堂課扣完剩下的</div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-neutral-500">→ 給</span>
            <PayeePicker
              aria-label="剩下的給誰"
              className="min-w-0 flex-1"
              value={rest.rest.type === "fund" ? `f:${rest.rest.locationId}` : "teachers"}
              options={[
                ...(rest.rest.type === "fund" ? withCurrent(locationOptions, rest.rest.locationId) : locationOptions).map((o) => ({
                  value: `f:${o.value}`,
                  label: o.label,
                  group: "公積金",
                })),
                { value: "teachers", label: "老師（可多位，按比重分）", group: "老師" },
              ]}
              onChange={(v) => {
                if (v === "teachers") {
                  if (rest.rest.type === "teachers") return;
                  onChange([...lines, { ...rest, rest: { type: "teachers", shares: defaultShares() } }]);
                } else {
                  onChange([...lines, { ...rest, rest: { type: "fund", locationId: Number(v.slice(2)) } }]);
                }
              }}
            />
          </div>
          {rest.rest.type === "teachers" && (
            <TeacherShares
              names={names}
              shares={rest.rest.shares}
              onChange={(shares) => onChange([...lines, { ...rest, rest: { type: "teachers", shares } }])}
            />
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-2 text-[13px] text-neutral-500">
            不夠扣時由 {names.location(defaultFund)}公積金 吸收
            <InfoTip label="不夠扣時誰吸收">
              上面幾行扣完如果是負的（收入不夠付固定金額或場地費），老師拿 0，差額記在這門課所在分部的公積金。
            </InfoTip>
          </div>
        </div>
      )}

      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-0">
        {rest.type === "rest" && <SplitPreview rows={rows} names={names} />}
        {status}
      </div>
    </div>
  );
}

/** 比例旁的快選（⅓ 存 100/3，剛好三等分）；照樣可以自己打。 */
function PctPresets({ onPick }: { onPick: (pct: number) => void }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="常用比例"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {PCT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="h-9 min-w-14 cursor-pointer rounded-lg px-2 text-sm tabular-nums text-neutral-800 hover:bg-neutral-100"
              onClick={() => {
                onPick(p.pct);
                setAnchor(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Menu>
    </>
  );
}

const PREVIEW_AMOUNTS = [2000, 3000, 5000];

/** 試算：假設這堂收了多少，用分帳引擎算一遍給每個人多少。 */
function SplitPreview({ rows, names }: { rows: RuleRow[]; names: SplitNames }) {
  const [income, setIncome] = useState(3000);
  const [custom, setCustom] = useState("");
  const { items, deficit, deficitFund, unknownVenue } = previewSplit(rows, income, names.venueUnit);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
      <div className="text-sm font-medium text-neutral-900">試算</div>
      <div className="flex flex-wrap items-center gap-2">
        {PREVIEW_AMOUNTS.map((a) => (
          <Button
            key={a}
            variant={!custom && income === a ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setCustom("");
              setIncome(a);
            }}
          >
            ${formatMoney(a)}
          </Button>
        ))}
        <div className={cn(fieldControlClass(), "flex h-9 w-28 items-center gap-1 px-3")}>
          <span className="text-neutral-500">$</span>
          <input
            aria-label="試算金額"
            inputMode="numeric"
            placeholder="自訂"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={custom}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d]/g, "");
              setCustom(t);
              if (t) setIncome(Number(t));
            }}
          />
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-neutral-800">
        {items.map((item, i) =>
          item.kind === "venuePack" ? (
            <li key={i} className="flex justify-between gap-2">
              <span>場地費 · {names.venue(item.venueId)}</span>
              {item.amount === null ? (
                <span className="text-neutral-500">還沒設定</span>
              ) : (
                <span className="tabular-nums">${formatMoney(item.amount)}</span>
              )}
            </li>
          ) : (
            <li key={i} className="flex justify-between gap-2">
              <span>{names.payee(item.payee)}</span>
              <span className="tabular-nums">${formatMoney(item.amount)}</span>
            </li>
          )
        )}
      </ul>
      {deficit > 0 && (
        <p className="text-[13px] text-danger-700">
          不夠扣 ${formatMoney(deficit)}，由{names.location(deficitFund)}公積金吸收
        </p>
      )}
      {unknownVenue && <p className="text-[13px] text-neutral-500">場地還沒設定每次多少，這裡沒算進去；實際剩下的會少一點。</p>}
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
    <div className="flex flex-wrap items-center gap-2">
      {names.teachers.map((t) => {
        const share = shares.find((s) => s.teacherId === t.id);
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-1.5 rounded-full border py-1 pl-2.5 text-sm",
              share ? "border-primary bg-primary-50 text-neutral-900" : "border-neutral-300 text-neutral-600",
              share && shares.length > 1 ? "pr-1.5" : "pr-2.5"
            )}
          >
            <button
              type="button"
              aria-pressed={!!share}
              className="flex items-center gap-1"
              onClick={() =>
                onChange(share ? shares.filter((s) => s.teacherId !== t.id) : [...shares, { teacherId: t.id, weight: 1 }])
              }
            >
              {share && <Check className="size-3.5 text-primary" aria-hidden />}
              {t.name}
            </button>
            {share && shares.length > 1 && (
              <span className="flex items-center gap-1 text-[13px] text-neutral-500">
                ×
                <NumInput
                  label={`${t.name}的比重`}
                  value={share.weight}
                  onChange={(weight) =>
                    onChange(shares.map((s) => (s.teacherId === t.id ? { ...s, weight } : s)))
                  }
                />
                <span className="tabular-nums">· {shareText(share.weight, shares)}</span>
              </span>
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
  lessonTeacherIds,
  lessonLocationId,
  initialRows,
  names,
  isLoading,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** 這次改會影響哪些課；收在編輯器標題的 ⓘ 裡。 */
  scopeNote?: string;
  sample?: RuleSample;
  lessonTeacherIds?: number[];
  lessonLocationId?: number | null;
  initialRows: RuleRow[];
  names: SplitNames;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (rows: RuleRow[]) => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const error = validateRows(rows);
  const check = error ? null : checkRule(rows, names, names.venueUnit);
  return (
    <Drawer
      open={open}
      title={title}
      subtitle={subtitle}
      submitText="儲存"
      size="wide"
      isLoading={isLoading}
      disabled={!!error}
      onClose={onClose}
      onSubmit={() => onSave(rows)}
    >
      <RuleEditor
        rows={rows}
        onChange={setRows}
        names={names}
        sample={sample}
        scopeNote={scopeNote}
        lessonTeacherIds={lessonTeacherIds}
        lessonLocationId={lessonLocationId}
        status={
          <>
      {error && <p className="text-[13px] text-danger-700">{error}</p>}
      {check && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-1.5 text-[13px]",
            check.ok ? "text-neutral-600" : "text-warning-700"
          )}
        >
          {check.ok ? (
            <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary-700" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          )}
          {check.text}
        </p>
      )}
          </>
        }
      />
    </Drawer>
  );
}
