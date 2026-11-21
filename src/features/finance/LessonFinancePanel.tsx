"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { netPairs } from "@/domains/finance/flows";
import type { Lesson } from "@/store/slices/lessons";
import {
  useGetFinanceSettingsQuery,
  useGetLessonFinanceQuery,
  useSetLessonRuleMutation,
  useSetPeriodOverrideMutation,
  useSettlePeriodMutation,
  useUnsettlePeriodMutation,
  type PeriodFinance,
} from "@/store/slices/finance";
import { RuleEditorDrawer } from "./RuleEditor";
import CardBranchDrawer from "./CardBranchDrawer";
import { describeRow, emptyRows, rowsToRule, ruleToRows, type RuleRow } from "./ruleEditorModel";
import { useSplitNames, type SplitNames } from "./useSplitNames";
import { MONEY_WARNINGS, REASON_TEXT, WARNING_TEXT, financeErrorText, periodLabel } from "./financeUi";

type Editing = { kind: "lesson" } | { kind: "period"; period: PeriodFinance };

/** 課程頁「分帳」：整門課的規則＋每一堂的錢與結清（docs/finance-lite.md）。 */
export default function LessonFinancePanel({ lesson }: { lesson: Lesson }) {
  const names = useSplitNames();
  const { data, isLoading } = useGetLessonFinanceQuery(lesson.id);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [setRule, { isLoading: savingRule }] = useSetLessonRuleMutation();
  const [setOverride, { isLoading: savingOverride }] = useSetPeriodOverrideMutation();

  const teacherIds = lesson.teachers.map((t) => t.id);
  const periods = useMemo(
    () =>
      (data?.periods ?? [])
        // 只列算錢的（點了名、過了轉換日）；轉換日前的堂不列，畫面才乾淨
        .filter((p) => p.counted || p.settlement)
        .sort((a, b) => b.startTime.localeCompare(a.startTime)),
    [data?.periods]
  );

  if (isLoading || !data || !names.ready) {
    return (
      <div className="flex flex-col gap-3 px-5 py-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl opacity-60" />
      </div>
    );
  }

  const ruleRows = data.rule ? ruleToRows(data.rule) : null;
  const overrideOf = (periodId: number) => data.overrides.find((o) => o.periodId === periodId)?.rule ?? null;

  const save = async (rows: RuleRow[]) => {
    if (!editing) return;
    try {
      if (editing.kind === "lesson") await setRule({ lessonId: lesson.id, rule: rowsToRule(rows) }).unwrap();
      else await setOverride({ lessonId: lesson.id, periodId: editing.period.periodId, rule: rowsToRule(rows) }).unwrap();
      toast.success("分帳規則已儲存");
      setEditing(null);
    } catch (e) {
      toast.error(financeErrorText(e));
    }
  };

  const initialRows =
    editing?.kind === "period"
      ? ruleToRows(overrideOf(editing.period.periodId) ?? data.rule ?? rowsToRule(emptyRows()))
      : ruleRows ?? emptyRows();

  return (
    <div className="flex flex-col gap-6 px-5 py-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1 text-base font-bold text-neutral-900">
            分帳規則
            <InfoTip label="分帳規則說明">
              每一堂點完名，照這條規則把這堂的課卡收入分給老師、場地和公積金。剩下的預設留給卡錢的分部。
              某一堂要另外算，可以在那一堂「這堂另外設」。
            </InfoTip>
          </h2>
          {names.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: "lesson" })}>
              {ruleRows ? "編輯" : "設定"}
            </Button>
          )}
        </div>
        {!lesson.locationId && (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-800">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            這門課還沒選分部，先在「設定」選分部，才會算錢。
          </p>
        )}
        {ruleRows ? (
          <ul className="flex flex-col gap-1 text-sm text-neutral-800">
            {ruleRows.map((row, i) => (
              <li key={i}>{describeRow(row, names.namer(lesson.locationId))}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">還沒設定：每一堂的錢會全部留給卡錢的分部。</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-neutral-900">每堂的錢</h2>
        {periods.length === 0 ? (
          <EmptyState kind="inline" title="還沒有點過名的時段" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {periods.map((p) => (
              <PeriodRow
                key={p.periodId}
                period={p}
                names={names}
                hasOverride={!!overrideOf(p.periodId)}
                onEditOverride={() => setEditing({ kind: "period", period: p })}
                onClearOverride={async () => {
                  try {
                    await setOverride({ lessonId: lesson.id, periodId: p.periodId, rule: null }).unwrap();
                    toast.success("這堂改回整門課的規則");
                  } catch (e) {
                    toast.error(financeErrorText(e));
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <RuleEditorDrawer
          open
          title={editing.kind === "lesson" ? "分帳規則" : `這堂另外設 · ${periodLabel(editing.period.startTime)}`}
          subtitle={lesson.name}
          scopeNote={
            editing.kind === "lesson"
              ? "改了之後，還沒結清的每一堂都照新的規則算；已結清的不會變。"
              : "只影響這一堂；其他堂照整門課的規則。"
          }
          sample={
            editing.kind === "period" && editing.period.income > 0
              ? { income: editing.period.income, packUnit: 0, label: "這堂" }
              : undefined
          }
          lessonTeacherIds={teacherIds}
          lessonLocationId={lesson.locationId}
          initialRows={initialRows}
          names={names}
          isLoading={savingRule || savingOverride}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function PeriodRow({
  period: p,
  names,
  hasOverride,
  onEditOverride,
  onClearOverride,
}: {
  period: PeriodFinance;
  names: SplitNames;
  hasOverride: boolean;
  onEditOverride: () => void;
  onClearOverride: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editCard, setEditCard] = useState<PeriodFinance["records"][number] | null>(null);
  const lessonLoc = p.lessonLocationId;
  const status = !p.counted ? (
    <StatusTag tone="neutral">不算錢</StatusTag>
  ) : p.settlement?.changed ? (
    <StatusTag tone="danger">結清後有改動</StatusTag>
  ) : p.settlement ? (
    <StatusTag tone="positive">已結清</StatusTag>
  ) : (
    <StatusTag tone="warning">待結清</StatusTag>
  );

  const teacherAndVenue = p.allocations.filter((a) => a.payee.type === "teacher" || a.payee.type === "venue");
  const pairs = netPairs(p.flows);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 text-[15px] font-medium text-neutral-900">{periodLabel(p.startTime)}</span>
        <span className="tabular-nums text-[15px] text-neutral-800">${formatMoney(Math.round(p.income))}</span>
        {status}
        <ChevronDown aria-hidden="true" className={cn("size-4 text-neutral-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {p.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-800">
              {p.warnings
                .filter((w) => w !== "NOT_TAKEN")
                .map((w) => (
                  <li key={w} className="flex items-start gap-1.5">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    {WARNING_TEXT[w]}
                  </li>
                ))}
            </ul>
          )}

          <Block title="收入">
            {p.records.map((r) => (
              <Line key={r.studentId} label={r.studentName} amount={r.amount}>
                {r.kind === "dropIn" && <StatusTag tone="outline">單堂</StatusTag>}
                {r.kind === "none" && <StatusTag tone="danger">沒卡</StatusTag>}
                {r.unpaid && <StatusTag tone="danger">未付</StatusTag>}
                {r.kind === "card" && lessonLoc && r.locationId !== lessonLoc && (
                  <StatusTag tone="neutral">錢在{names.location(r.locationId)}</StatusTag>
                )}
                {r.kind === "card" && names.canEdit && !p.settlement && (
                  <Button variant="link" size="sm" className="text-[13px]" onClick={() => setEditCard(r)}>
                    分部
                  </Button>
                )}
              </Line>
            ))}
          </Block>

          <Block title="分給">
            {teacherAndVenue.map((a, i) => (
              <Line key={i} label={names.payee(a.payee, lessonLoc)} amount={a.amount} />
            ))}
            {p.branchIncome.map((b) => (
              <Line key={b.locationId} label={`${names.location(b.locationId)}（機構）`} amount={b.amount} />
            ))}
          </Block>

          {pairs.length > 0 && (
            <Block title={p.settlement ? "往來" : "結清後的往來"}>
              {pairs.map((pair) => (
                <li key={`${pair.from}-${pair.to}`} className="flex flex-col gap-0.5">
                  <div className="flex justify-between gap-2 text-sm font-medium text-neutral-900">
                    <span>
                      {names.location(pair.from)} 欠 {names.location(pair.to)}
                    </span>
                    <span className="tabular-nums">${formatMoney(Math.round(pair.amount))}</span>
                  </div>
                  <span className="text-[13px] text-neutral-500">
                    {p.flows
                      .filter((f) => (f.from === pair.from && f.to === pair.to) || (f.from === pair.to && f.to === pair.from))
                      .map((f) => `${REASON_TEXT[f.reason]} ${f.from === pair.from ? "" : "−"}$${formatMoney(Math.round(f.amount))}`)
                      .join("、")}
                  </span>
                </li>
              ))}
            </Block>
          )}

          {editCard && editCard.studentCardId && (
            <CardBranchDrawer
              card={{
                id: editCard.studentCardId,
                serialNumber: editCard.serialNumber,
                studentName: editCard.studentName,
                moneyLocationId: p.warnings.includes("CARD_NO_BRANCH") && editCard.locationId === lessonLoc ? null : editCard.locationId,
                homeLocationId: editCard.homeLocationId,
              }}
              names={names}
              onClose={() => setEditCard(null)}
            />
          )}

          {names.canEdit && p.counted && (
            <SettleBar period={p} names={names} hasOverride={hasOverride} onEditOverride={onEditOverride} onClearOverride={onClearOverride} />
          )}
        </div>
      )}
    </li>
  );
}

function SettleBar({
  period: p,
  names,
  hasOverride,
  onEditOverride,
  onClearOverride,
}: {
  period: PeriodFinance;
  names: SplitNames;
  hasOverride: boolean;
  onEditOverride: () => void;
  onClearOverride: () => void;
}) {
  const { data: settings } = useGetFinanceSettingsQuery();
  const [settle, { isLoading: settling }] = useSettlePeriodMutation();
  const [unsettle, { isLoading: unsettling }] = useUnsettlePeriodMutation();
  const keepers = [...new Set((settings?.locations ?? []).map((l) => l.keeperUserId).filter((x): x is number => x !== null))];
  const [payer, setPayer] = useState<number | null>(p.defaultPayerUserId ?? keepers[0] ?? null);
  const moneyMissing = p.warnings.some((w) => MONEY_WARNINGS.includes(w));

  if (p.settlement) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <span className="flex-1 text-[13px] text-neutral-600">{names.member(p.settlement.paidByUserId)} 付的</span>
        <Button
          variant="ghost"
          size="sm"
          isLoading={unsettling}
          onClick={async () => {
            try {
              await unsettle(p.periodId).unwrap();
              toast.success("已取消結清");
            } catch (e) {
              toast.error(financeErrorText(e));
            }
          }}
        >
          取消結清
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-neutral-600">誰付老師和場地</span>
        <Select
          size="sm"
          aria-label="誰付的"
          className="min-w-32 flex-1"
          value={payer ?? undefined}
          options={keepers.map((id) => ({ value: id, label: names.member(id) }))}
          onChange={setPayer}
        />
        <Button
          size="sm"
          isLoading={settling}
          disabled={!payer}
          onClick={async () => {
            try {
              await settle({ periodId: p.periodId, paidByUserId: payer }).unwrap();
              toast.success("已結清");
            } catch (e) {
              toast.error(financeErrorText(e));
            }
          }}
        >
          已結清
        </Button>
      </div>
      {moneyMissing && <p className="text-[13px] text-warning-800">錢還沒收齊，確定要結清嗎？結清後數字就固定了。</p>}
      <div className="flex gap-3">
        <Button variant="link" size="sm" onClick={onEditOverride}>
          {hasOverride ? "改這堂的規則" : "這堂另外設"}
        </Button>
        {hasOverride && (
          <Button variant="link" size="sm" onClick={onClearOverride}>
            用回整門課的規則
          </Button>
        )}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-medium text-neutral-500">{title}</h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function Line({ label, amount, children }: { label: string; amount: number; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-neutral-800">
      <span className="min-w-0 truncate">{label}</span>
      {children}
      <span className="ml-auto tabular-nums">${formatMoney(Math.round(amount))}</span>
    </li>
  );
}
