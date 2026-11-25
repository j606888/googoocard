"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, PencilLine, X } from "lucide-react";
import { toast } from "sonner";
import { type Lesson, useUpdateRevenueSplitMutation } from "@/store/slices/lessons";
import { Button } from "@/components/ui/button";
import Select from "@/components/Select";
import { SegmentedControl } from "@/features/lessons/newLesson/grouped";
import { formatMoney } from "@/lib/money";
import {
  type RevenueSplit,
  type SplitBasis,
  SPLIT_BASIS_LABEL,
  computeSplit,
  defaultRemainderLabel,
  formatRatio,
  parseRatio,
  parseRevenueSplit,
} from "@/lib/revenueSplit";

interface DraftStep {
  key: number;
  label: string;
  teacherId: number | null;
  basis: SplitBasis;
  ratio: string;
  amount: string;
}

let nextKey = 1;

const toDraft = (split: RevenueSplit | null): DraftStep[] =>
  (split?.steps ?? []).map((s) => ({
    key: nextKey++,
    label: s.label,
    teacherId: s.teacherId,
    basis: s.basis,
    ratio: formatRatio(s.num, s.den),
    amount: s.amount === null ? "" : String(s.amount),
  }));

/** 草稿 → 規則；有一步看不懂就回 null（不能存、試算也先不算那一步）。 */
const fromDraft = (steps: DraftStep[], remainderLabel: string): RevenueSplit | null => {
  const out: RevenueSplit["steps"] = [];
  for (const s of steps) {
    if (!s.label.trim()) return null;
    if (s.basis === "fixed") {
      const amount = Number(s.amount);
      if (s.amount.trim() === "" || !Number.isInteger(amount) || amount < 0) return null;
      out.push({ label: s.label.trim(), teacherId: s.teacherId, basis: "fixed", num: null, den: null, amount });
    } else {
      const ratio = parseRatio(s.ratio);
      if (!ratio) return null;
      out.push({ label: s.label.trim(), teacherId: s.teacherId, basis: s.basis, ...ratio, amount: null });
    }
  }
  return { steps: out, remainderLabel: remainderLabel.trim() || "水庫" };
};

const INPUT =
  "h-9 rounded-md border border-neutral-300 bg-white px-2.5 text-sm text-ink outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100";

/**
 * 桌面課程頁「分潤」分頁：一堂收入照順序一步一步分，剩下的歸水庫（src/lib/revenueSplit.ts）。
 * 每一步明寫從「總收入／剩下的／固定 $」算，旁邊用最近一堂的收入試算。
 *
 * 有規則時預設唯讀，按「編輯」才出現控制項——整頁都是一碰就改的分段控制與叉叉，
 * 手滑就改掉了（2026-11-26 使用者要求）。還沒設定過的課直接是編輯狀態。
 */
const RevenueSplitPanel = ({
  lesson,
  revenues,
  onViewPeriod,
}: {
  lesson: Lesson;
  revenues: Map<number, number>;
  /** 桌面：在原地開那堂的點名紀錄側欄。沒給（手機）就連到那堂的點名結果頁。 */
  onViewPeriod?: (periodId: number) => void;
}) => {
  const saved = useMemo(() => parseRevenueSplit(lesson.revenueSplit), [lesson.revenueSplit]);
  const [steps, setSteps] = useState<DraftStep[]>(() => toDraft(saved));
  const [remainderLabel, setRemainderLabel] = useState(
    () => saved?.remainderLabel ?? defaultRemainderLabel(lesson.location?.name)
  );
  const [dragKey, setDragKey] = useState<number | null>(null);
  const hasSaved = Boolean(saved && saved.steps.length > 0);
  const [editing, setEditing] = useState(!hasSaved);
  const [updateSplit, { isLoading }] = useUpdateRevenueSplitMutation();

  const draft = fromDraft(steps, remainderLabel);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || (draft === null && steps.length > 0);

  const taken = (lesson.periods ?? []).filter((p) => p.attendanceTakenAt);
  const sample = [...taken].reverse().find((p) => revenues.has(p.id));
  const sampleIncome = sample ? (revenues.get(sample.id) ?? 0) : 0;
  const preview = draft ? computeSplit(sampleIncome, draft) : null;
  const rule = draft ?? saved;

  const people = [...lesson.teachers, ...lesson.assistants];
  const unused = people.filter((p) => !steps.some((s) => s.teacherId === p.id));

  const patch = (key: number, change: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...change } : s)));
  const move = (from: number, to: number) =>
    setSteps((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const add = (value: string) => {
    if (!value) return;
    const person = people.find((p) => String(p.id) === value);
    setSteps((prev) => [
      ...prev,
      person
        ? { key: nextKey++, label: person.name, teacherId: person.id, basis: "total", ratio: "", amount: "" }
        : value === "venue"
          ? { key: nextKey++, label: "場地費", teacherId: null, basis: "fixed", ratio: "", amount: "" }
          : { key: nextKey++, label: "", teacherId: null, basis: "fixed", ratio: "", amount: "" },
    ]);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await updateSplit({ id: lesson.id, split: draft.steps.length > 0 ? draft : null }).unwrap();
      toast.success("分潤規則已儲存");
      if (draft.steps.length > 0) setEditing(false);
    } catch {
      toast.error("儲存失敗，請再試一次");
    }
  };

  const cancel = () => {
    setSteps(toDraft(saved));
    setRemainderLabel(saved?.remainderLabel ?? defaultRemainderLabel(lesson.location?.name));
    setEditing(!hasSaved);
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-10">
      <section aria-labelledby="split-rule-title" className="flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 id="split-rule-title" className="text-base font-semibold text-ink">
              分潤順序
            </h2>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilLine className="size-4" />
                編輯
              </Button>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
            每堂點完名，從上往下一步一步分
            {editing ? (
              <>
                ，用箭頭（電腦也可以拖 <GripVertical className="inline size-3.5 align-[-2px]" />）改順序。
              </>
            ) : (
              "。"
            )}
            {sample
              ? `右邊用 ${format(new Date(sample.startTime), "M/d")}（收入 $${formatMoney(sampleIncome)}）試算。`
              : "還沒有點過名的堂，先用 $0 試算。"}
          </p>
        </div>

        {!editing && (
          <ol className="border-y border-neutral-300">
            {steps.map((s, index) => {
              const line = preview?.lines[index];
              return (
                <li key={s.key} className="flex min-h-14 items-center gap-3 border-b border-line py-2">
                  <span className="w-4 shrink-0 text-[13px] tabular-nums text-ink-3">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{s.label}</span>
                  <span className="text-right leading-tight">
                    <b className="block text-[15px] font-semibold tabular-nums text-ink">
                      ${formatMoney(line?.amount ?? 0)}
                    </b>
                    <span className="text-xs text-ink-3">{line?.formula}</span>
                  </span>
                </li>
              );
            })}
            <li className="flex min-h-14 items-center gap-3 py-2 pl-7">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                剩下的全部歸 {remainderLabel}
              </span>
              {preview && (
                <b
                  className={`text-[15px] font-semibold tabular-nums ${
                    preview.remainder.amount < 0 ? "text-danger-700" : "text-ink"
                  }`}
                >
                  ${formatMoney(preview.remainder.amount)}
                </b>
              )}
            </li>
          </ol>
        )}

        {editing && (
        <>
        <ol className="border-y border-neutral-300">
          {steps.map((s, index) => {
            const line = preview?.lines[index];
            return (
              <li
                key={s.key}
                draggable
                onDragStart={() => setDragKey(s.key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragKey === null || dragKey === s.key) return;
                  const from = steps.findIndex((x) => x.key === dragKey);
                  move(from, index);
                }}
                onDragEnd={() => setDragKey(null)}
                className={`flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2 pr-1 last:border-b-0 lg:flex-nowrap ${
                  dragKey === s.key ? "bg-primary-50" : ""
                }`}
              >
                <span className="flex shrink-0 items-center text-ink-3">
                  <GripVertical aria-hidden="true" className="hidden size-4 cursor-grab lg:block" />
                  <span className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`${s.label || "這一步"}往上移`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      className="cursor-pointer rounded p-0.5 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${s.label || "這一步"}往下移`}
                      disabled={index === steps.length - 1}
                      onClick={() => move(index, index + 1)}
                      className="cursor-pointer rounded p-0.5 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </span>
                </span>
                <span className="w-4 shrink-0 text-[13px] tabular-nums text-ink-3">{index + 1}</span>
                {s.teacherId === null ? (
                  <input
                    aria-label={`第 ${index + 1} 步名稱`}
                    value={s.label}
                    placeholder="名稱"
                    maxLength={20}
                    onChange={(e) => patch(s.key, { label: e.target.value })}
                    className={`${INPUT} min-w-0 flex-1 lg:w-32 lg:flex-none`}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink lg:w-32 lg:flex-none">{s.label}</span>
                )}
                {/* 手機換行：「從哪裡算＋比例」排到第二行。 */}
                <span aria-hidden="true" className="order-last h-0 basis-full lg:hidden" />
                <SegmentedControl
                  ariaLabel={`${s.label || "這一步"}從哪裡算`}
                  className="order-last ml-9 min-w-0 flex-1 lg:order-none lg:ml-0 lg:w-60 lg:flex-none lg:shrink-0"
                  value={s.basis}
                  onChange={(basis) => patch(s.key, { basis })}
                  options={(["total", "remaining", "fixed"] as const).map((b) => ({ value: b, label: SPLIT_BASIS_LABEL[b] }))}
                />
                {s.basis === "fixed" ? (
                  <input
                    aria-label={`${s.label || "這一步"}金額`}
                    inputMode="numeric"
                    placeholder="500"
                    value={s.amount}
                    onChange={(e) => patch(s.key, { amount: e.target.value.replace(/[^\d]/g, "") })}
                    className={`${INPUT} order-last w-20 text-right lg:order-none`}
                  />
                ) : (
                  <input
                    aria-label={`${s.label || "這一步"}比例`}
                    placeholder="1/3"
                    value={s.ratio}
                    onChange={(e) => patch(s.key, { ratio: e.target.value })}
                    className={`${INPUT} order-last w-20 text-right lg:order-none`}
                  />
                )}
                <span className="ml-auto text-right leading-tight lg:w-36">
                  {line ? (
                    <>
                      <b className="block text-[15px] font-semibold tabular-nums text-ink">${formatMoney(line.amount)}</b>
                      <span className="text-xs text-ink-3">{line.formula}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-3">{s.basis === "fixed" ? "填金額" : "填 1/3 或 25%"}</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`刪除 ${s.label || "這一步"}`}
                  onClick={() => setSteps((prev) => prev.filter((x) => x.key !== s.key))}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-neutral-100 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
          <li className="flex min-h-16 items-center gap-3 py-2 pr-1 pl-9 lg:pl-[3.25rem]">
            <span className="shrink-0 text-[15px] font-medium text-ink">剩下的全部歸</span>
            <input
              aria-label="剩下的歸給誰"
              value={remainderLabel}
              maxLength={20}
              onChange={(e) => setRemainderLabel(e.target.value)}
              className={`${INPUT} min-w-0 w-28 lg:w-36`}
            />
            <span className="ml-auto text-right leading-tight lg:w-36">
              {preview && (
                <b
                  className={`block text-[15px] font-semibold tabular-nums ${
                    preview.remainder.amount < 0 ? "text-danger-700" : "text-ink"
                  }`}
                >
                  ${formatMoney(preview.remainder.amount)}
                </b>
              )}
            </span>
            <span className="hidden size-8 shrink-0 lg:block" />
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Select<string>
            aria-label="加一步"
            size="sm"
            className="w-56"
            value=""
            placeholder="＋ 加一步…"
            onChange={add}
            options={[
              ...unused.map((p) => ({ value: String(p.id), label: p.name })),
              { value: "venue", label: "場地費" },
              { value: "other", label: "其他（自己取名）" },
            ]}
          />
          <span className="flex-1" />
          {draft === null && steps.length > 0 && <span className="text-[13px] text-warning-800">有一步還沒填好</span>}
          {(hasSaved || steps.length > 0) && (
            <Button variant="secondary" onClick={cancel} disabled={isLoading}>
              取消
            </Button>
          )}
          <Button onClick={save} isLoading={isLoading} disabled={!dirty || draft === null}>
            儲存
          </Button>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-3">
          「總收入」不管前面扣了什麼；「剩下的」是前面扣完之後。每一步捨去到整數元，零頭留給最後。開新一期會沿用這組規則。
        </p>
        </>
        )}
      </section>

      {rule && rule.steps.length > 0 && (
        <section aria-labelledby="split-table-title">
          <h2 id="split-table-title" className="mb-2 text-base font-semibold text-ink">
            每一堂分到多少
          </h2>
          <SplitTable lesson={lesson} rule={rule} revenues={revenues} onViewPeriod={onViewPeriod} />
        </section>
      )}
    </div>
  );
};

const SplitTable = ({
  lesson,
  rule,
  revenues,
  onViewPeriod,
}: {
  lesson: Lesson;
  rule: RevenueSplit;
  revenues: Map<number, number>;
  onViewPeriod?: (periodId: number) => void;
}) => {
  const rows = (lesson.periods ?? []).map((p) => ({
    period: p,
    split: p.attendanceTakenAt && revenues.has(p.id) ? computeSplit(revenues.get(p.id) ?? 0, rule) : null,
  }));
  const done = rows.flatMap((r) => (r.split ? [r.split] : []));
  const total = (pick: (s: ReturnType<typeof computeSplit>) => number) => done.reduce((sum, s) => sum + pick(s), 0);
  const cell = "h-11 px-3 text-right tabular-nums";
  const dateOf = (period: { startTime: string }) => format(new Date(period.startTime), "M/d");
  const recordHref = (periodId: number) => `/lessons/${lesson.id}/periods/${periodId}/check-success`;

  return (
    <>
      {/* 手機：一堂一張直式的小卡——六欄的表只能橫捲，看不到全貌。點進去是那堂的點名結果。 */}
      <ol className="flex flex-col border-y border-neutral-300 lg:hidden">
        {rows.map(({ period, split }) =>
          split ? (
            <li key={period.id} className="border-b border-line last:border-b-0">
              <Link href={recordHref(period.id)} className="flex flex-col gap-1 py-3 text-sm">
                <span className="flex items-center justify-between font-semibold text-ink">
                  <span className="tabular-nums">{dateOf(period)}</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    收入 ${formatMoney(split.income)}
                    <ChevronRight className="size-4 text-ink-3" />
                  </span>
                </span>
                {split.lines.map((l, i) => (
                  <span key={i} className="flex justify-between pr-5 text-ink-3">
                    <span>{l.label}</span>
                    <span className="tabular-nums text-ink">${formatMoney(l.amount)}</span>
                  </span>
                ))}
                <span className="flex justify-between pr-5 text-ink-3">
                  <span>{split.remainder.label}</span>
                  <span className={`tabular-nums ${split.remainder.amount < 0 ? "text-danger-700" : "text-ink"}`}>
                    ${formatMoney(split.remainder.amount)}
                  </span>
                </span>
              </Link>
            </li>
          ) : (
            <li key={period.id} className="flex justify-between border-b border-line py-3 text-sm last:border-b-0">
              <span className="font-semibold tabular-nums text-ink-3">{dateOf(period)}</span>
              <span className="text-ink-3">還沒點名</span>
            </li>
          )
        )}
        {done.length > 0 && (
          <li className="flex flex-col gap-1 py-3 text-sm font-semibold text-ink">
            <span className="flex justify-between">
              <span>合計</span>
              <span className="tabular-nums">收入 ${formatMoney(total((s) => s.income))}</span>
            </span>
            {rule.steps.map((s, i) => (
              <span key={i} className="flex justify-between font-normal">
                <span>{s.label}</span>
                <span className="tabular-nums">${formatMoney(total((x) => x.lines[i]?.amount ?? 0))}</span>
              </span>
            ))}
            <span className="flex justify-between font-normal">
              <span>{rule.remainderLabel}</span>
              <span className="tabular-nums">${formatMoney(total((x) => x.remainder.amount))}</span>
            </span>
          </li>
        )}
      </ol>
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-xs text-ink-3">
            <th className="h-10 pr-3 text-left font-normal">日期</th>
            <th className="h-10 px-3 text-right font-normal">收入</th>
            {rule.steps.map((s, i) => (
              <th key={i} className="h-10 px-3 text-right font-normal">
                {s.label}
              </th>
            ))}
            <th className="h-10 pl-3 text-right font-normal">{rule.remainderLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ period, split }) => (
            <tr key={period.id} className="border-b border-line">
              <td className="h-11 pr-3 font-medium tabular-nums">
                {!split ? (
                  dateOf(period)
                ) : onViewPeriod ? (
                  <button
                    type="button"
                    onClick={() => onViewPeriod(period.id)}
                    className="cursor-pointer text-primary-800 underline-offset-4 hover:underline"
                  >
                    {dateOf(period)}
                  </button>
                ) : (
                  <Link href={recordHref(period.id)} className="text-primary-800 underline-offset-4 hover:underline">
                    {dateOf(period)}
                  </Link>
                )}
              </td>
              {split ? (
                <>
                  <td className={cell}>${formatMoney(split.income)}</td>
                  {split.lines.map((l, i) => (
                    <td key={i} className={cell}>
                      ${formatMoney(l.amount)}
                    </td>
                  ))}
                  <td className={`${cell} pr-0 ${split.remainder.amount < 0 ? "text-danger-700" : ""}`}>
                    ${formatMoney(split.remainder.amount)}
                  </td>
                </>
              ) : (
                <td colSpan={rule.steps.length + 2} className="h-11 px-3 text-right text-ink-3">
                  還沒點名
                </td>
              )}
            </tr>
          ))}
          {done.length > 0 && (
            <tr className="font-semibold">
              <td className="h-11 pr-3">合計</td>
              <td className={cell}>${formatMoney(total((s) => s.income))}</td>
              {rule.steps.map((_, i) => (
                <td key={i} className={cell}>
                  ${formatMoney(total((s) => s.lines[i]?.amount ?? 0))}
                </td>
              ))}
              <td className={`${cell} pr-0`}>${formatMoney(total((s) => s.remainder.amount))}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
};

/** 點名紀錄側欄裡「這堂怎麼分」。沒設定分潤就不顯示。 */
export const PeriodSplitBreakdown = ({ lesson, income }: { lesson: Lesson; income: number }) => {
  const rule = parseRevenueSplit(lesson.revenueSplit);
  if (!rule || rule.steps.length === 0) return null;
  const split = computeSplit(income, rule);
  return (
    <section aria-label="這堂怎麼分" className="flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
      <h3 className="text-xs font-semibold text-ink-3">這堂怎麼分</h3>
      {split.lines.map((l, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <span className="text-ink">
            {i + 1} · {l.label}
            <span className="ml-1.5 text-xs text-ink-3">{l.formula}</span>
          </span>
          <b className="font-semibold tabular-nums">${formatMoney(l.amount)}</b>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
        <span>剩下的 → {split.remainder.label}</span>
        <b className={`font-semibold tabular-nums ${split.remainder.amount < 0 ? "text-danger-700" : ""}`}>
          ${formatMoney(split.remainder.amount)}
        </b>
      </div>
    </section>
  );
};

export default RevenueSplitPanel;
