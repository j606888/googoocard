"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import DataView, { type DataViewColumn } from "@/components/DataView";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { planSettlement } from "@/domains/finance/settlement";
import { calculateSplit, type SplitResult } from "@/domains/finance/split";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import Money, { EXPENSE_TEXT, moneyText } from "../Money";
import {
  CURRENT_CLOSE_STEP,
  branchSettlement,
  closeHoldings,
  closeSteps,
  closeTank,
  monthSessions,
  monthlyReport,
  payroll,
  period,
  rules,
} from "../mockData";
import type { MonthSession, PayrollRow } from "../types";
import { LaterAction, Panel, PanelTitle } from "../ui";
import SettlementPlan from "./SettlementPlan";

/** 逐堂明細最多先列幾堂。 */
const PAYSLIP_PREVIEW = 3;

/** 月結與發薪：步驟、薪資表、逐堂明細、結算計畫、據點間拆帳、月報摘要。 */
export default function MonthClose() {
  const canEdit = useCan("finance.edit");
  const [step, setStep] = useState(CURRENT_CLOSE_STEP);
  const [previewName, setPreviewName] = useState(payroll[0]?.name ?? "");

  const plan = planSettlement({
    payees: payroll.map((p) => ({ name: p.name, owed: p.total })),
    holdings: closeHoldings,
    tank: closeTank,
  });
  const preview = payroll.find((p) => p.name === previewName) ?? payroll[0];
  const nextStep = closeSteps[step + 1];

  const advance = () => {
    if (!nextStep) return;
    setStep(step + 1);
    toast.success(`（示意）進到「${nextStep.label}」`);
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        title={`${period.monthName}月結`}
        description={`${period.firstDay} – ${period.closeDay} · 發薪日 ${period.payday}`}
        actions={
          <>
            <LaterAction size="sm">
              <FileText className="size-4" />
              預覽月報 PDF
            </LaterAction>
            {canEdit && nextStep && (
              <Button variant="secondary" onClick={advance}>
                下一步：{nextStep.label}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </>
        }
      />

      <ol aria-label="月結步驟" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {closeSteps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li
              key={s.label}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-3 lg:px-4",
                state === "current" ? "border-primary-700 bg-primary-50 ring-1 ring-primary-700" : "border-neutral-200 bg-white"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums",
                  state === "done"
                    ? "bg-primary-900 text-white"
                    : state === "current"
                      ? "bg-white font-bold text-primary-900 ring-1 ring-primary-700"
                      : "bg-neutral-100 text-neutral-600"
                )}
              >
                {state === "done" ? <Check className="size-4" aria-label="完成" /> : i + 1}
              </span>
              <div className="min-w-0">
                <div className={cn("text-[15px] text-neutral-900", state === "current" ? "font-bold" : state === "done" && "font-medium")}>
                  {s.label}
                </div>
                <div className={cn("text-xs lg:text-[13px]", state === "current" ? "text-primary-900" : "text-neutral-500")}>
                  {s.note}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <PayrollTable selected={preview?.name} onSelect={setPreviewName} />
          {preview && <PayslipPreview payee={preview} />}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <SettlementPlan lines={plan.lines} transfers={plan.transfers} tankOwner={closeTank.owner} canEdit={canEdit} />

          <Panel className="flex flex-col gap-2 p-4 lg:p-6">
            <PanelTitle>據點間拆帳</PanelTitle>
            <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_auto] items-center gap-2 border-t border-neutral-100 pt-2.5 text-[15px] text-neutral-900">
              <span>{branchSettlement.from}</span>
              <ArrowLeftRight aria-hidden="true" className="size-4 text-neutral-400" />
              <span>{branchSettlement.to}</span>
              <Money value={branchSettlement.amount} className="font-semibold" />
            </div>
            <p className="text-[13px] text-neutral-500">{branchSettlement.note}</p>
          </Panel>

          <MonthlyReportCard />
        </div>
      </div>
    </div>
  );
}

type PayrollViewRow = { kind: "member"; row: PayrollRow } | { kind: "total"; classes: number; total: number };

function PayrollTable({ selected, onSelect }: { selected?: string; onSelect: (name: string) => void }) {
  const rows: PayrollViewRow[] = [
    ...payroll.map((row) => ({ kind: "member" as const, row })),
    {
      kind: "total",
      classes: payroll.reduce((sum, p) => sum + p.classes, 0),
      total: payroll.reduce((sum, p) => sum + p.total, 0),
    },
  ];

  const columns: DataViewColumn<PayrollViewRow>[] = [
    {
      key: "name",
      header: "成員",
      width: "minmax(0,1.4fr)",
      role: "primary",
      render: (r) =>
        r.kind === "total" ? (
          <span className="text-[15px] font-bold text-neutral-900">合計</span>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(r.row.name)}
            aria-pressed={r.row.name === selected}
            className="text-left text-[15px] text-neutral-900 after:absolute after:inset-0 cursor-pointer focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary-300"
          >
            <span className={cn(r.row.name === selected && "font-bold")}>{r.row.name}</span>
            <span className="ml-2 text-[13px] font-medium text-primary-700">{r.row.name === selected ? "預覽中" : "預覽"}</span>
          </button>
        ),
    },
    {
      key: "classes",
      header: "堂數",
      width: "64px",
      mobileLabel: "堂數",
      render: (r) => <span className="tabular-nums">{r.kind === "total" ? r.classes : r.row.classes}</span>,
    },
    {
      key: "status",
      header: "狀態",
      width: "88px",
      hideOnMobile: (r) => r.kind === "total",
      render: (r) =>
        r.kind === "total" ? null : r.row.confirmed ? (
          <StatusTag tone="positive">已確認</StatusTag>
        ) : (
          <StatusTag tone="warning">待確認</StatusTag>
        ),
    },
    {
      key: "total",
      header: "分潤合計",
      width: "112px",
      role: "trailing",
      render: (r) => (
        <Money
          value={r.kind === "total" ? r.total : r.row.total}
          className={cn("ml-auto text-[15px] text-neutral-900", (r.kind === "total" || r.row.name === selected) && "font-semibold")}
        />
      ),
    },
  ];

  return (
    <section aria-label="薪資表" className="flex flex-col gap-3">
      <PanelTitle>薪資表</PanelTitle>
      <DataView
        columns={columns}
        rows={rows}
        rowKey={(r) => (r.kind === "total" ? "total" : r.row.name)}
        rowClassName={(r) =>
          r.kind === "total" ? "bg-neutral-50" : r.row.name === selected ? "bg-primary-50" : "hover:bg-neutral-50"
        }
      />
    </section>
  );
}

type PayslipLine = MonthSession & { split: SplitResult };

function PayslipPreview({ payee }: { payee: PayrollRow }) {
  const lines: PayslipLine[] = monthSessions
    .filter((s) => s.members.includes(payee.name))
    .slice(0, PAYSLIP_PREVIEW)
    .map((s) => {
      const rule = rules.find((r) => r.id === s.ruleId) ?? rules[0];
      return {
        ...s,
        split: calculateSplit({
          income: s.income,
          rent: s.rent,
          poolRate: rule.poolRate,
          memberCount: s.members.length,
          roundUnit: rule.roundUnit,
        }),
      };
    });
  const more = payee.classes - lines.length;

  const columns: DataViewColumn<PayslipLine>[] = [
    {
      key: "session",
      header: "場次",
      width: "minmax(0,2fr)",
      role: "primary",
      render: (l) => (
        <span className="block text-sm text-neutral-900">
          {l.date} {l.title} · {l.branch}
          {l.members.length === 1 && "（單師）"}
        </span>
      ),
    },
    { key: "income", header: "收入", width: "72px", mobileLabel: "收入", render: (l) => <Money value={l.income} className="lg:ml-auto" /> },
    {
      key: "rent",
      header: "場租",
      width: "64px",
      mobileLabel: "場租",
      render: (l) => <Money value={-l.rent} className={cn("lg:ml-auto", EXPENSE_TEXT)} />,
    },
    {
      key: "pool",
      header: "水庫提撥",
      width: "72px",
      mobileLabel: "水庫",
      render: (l) => <Money value={-l.split.pool} className="lg:ml-auto" />,
    },
    {
      key: "perMember",
      header: "÷ 人數",
      width: "72px",
      render: (l) => (
        <span className="text-neutral-500 lg:ml-auto">
          <span className="lg:hidden">÷ {l.members.length} = </span>
          <Money value={l.split.perMember} />
        </span>
      ),
    },
    {
      key: "rounded",
      header: "取整後",
      width: "72px",
      role: "trailing",
      render: (l) => <Money value={l.split.perMemberRounded} className="ml-auto text-[15px] font-semibold text-neutral-900" />,
    },
  ];

  return (
    <section aria-label={`${payee.name}的逐堂明細`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle>{payee.name} · 逐堂明細</PanelTitle>
        <span className="text-[13px] text-neutral-500">老師打開自己的薪資單，看到的就是這份</span>
      </div>
      <DataView columns={columns} rows={lines} rowKey={(l) => l.id} />
      {more > 0 && <p className="px-1 text-[13px] text-neutral-500">…還有 {more} 堂</p>}
    </section>
  );
}

function MonthlyReportCard() {
  const tankChange = monthlyReport.income - monthlyReport.expense - monthlyReport.payroll;
  return (
    <section aria-label="月報摘要" className="flex flex-col gap-2.5 rounded-2xl bg-primary-900 px-5 py-5 text-white lg:px-6">
      <h3 className="mb-1 text-base font-bold">月報摘要</h3>
      <ReportRow label="認列收入" value={moneyText(monthlyReport.income)} />
      <ReportRow label="支出" value={moneyText(-monthlyReport.expense)} valueClass="text-warning-300" />
      <ReportRow label="老師分潤" value={moneyText(-monthlyReport.payroll)} valueClass="text-warning-300" />
      <div className="border-t border-white/20 pt-2.5">
        <ReportRow label="水位變化" value={moneyText(tankChange, { sign: true })} valueClass="font-bold" />
      </div>
      <ReportRow label="預收課卡餘額" value={moneyText(monthlyReport.prepaidBalance)} />
    </section>
  );
}

function ReportRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[15px]">
      <span className="text-primary-100">{label}</span>
      <span className={cn("tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
