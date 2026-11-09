"use client";

// 報表（docs/finance-v2/05 §3.2–3.6；設計稿「損益表」「資產負債表」）。金額單位「分」。
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import Select from "@/components/Select";
import { monthOf } from "@/domains/finance/months";
import { monthRange, type BalanceSheet, type BsLine, type CashFlow, type DeferredRollforward, type Pnl, type PnlSection, type TrialBalanceRow } from "@/domains/ledger/reports";
import { cn } from "@/lib/utils";
import { useGetLedgerAccountsQuery, useGetLedgerReportQuery, type LedgerReportArgs } from "@/store/slices/ledger";
import type { ReportName } from "@/service/ledger/reports";
import MonthSwitcher from "../MonthSwitcher";
import { todayKey } from "../financeUi";
import { Amount, FinanceCard, FinanceShell } from "./ui";

export const REPORTS: Record<ReportName, { title: string; hint: string; dated: "range" | "asOf" }> = {
  pnl: { title: "損益表", hint: "這段期間賺多少", dated: "range" },
  "balance-sheet": { title: "資產負債表", hint: "某一天有的、欠的、自己的", dated: "asOf" },
  "cash-flow": { title: "現金流量", hint: "錢從哪裡來、去了哪裡", dated: "range" },
  "deferred-revenue": { title: "預收餘額", hint: "還欠學生的課", dated: "range" },
  receivables: { title: "應收帳齡", hint: "還沒付錢的卡與單堂", dated: "asOf" },
  payables: { title: "應付明細", hint: "該付給老師、場地、業主的錢", dated: "asOf" },
  lessons: { title: "課程獲利", hint: "每門課的收入、老師、場地、毛利", dated: "range" },
  "trial-balance": { title: "試算表", hint: "每個科目的借貸，給記帳士", dated: "asOf" },
  "general-ledger": { title: "總分類帳", hint: "某個科目的每一筆", dated: "range" },
};

export function ReportsIndex() {
  return (
    <FinanceShell title="報表" guide="reports">
      <FinanceCard className="divide-y divide-neutral-100">
        {(Object.keys(REPORTS) as ReportName[]).map((name) => (
          <Link key={name} href={`/finance/reports/${name}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-neutral-50">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-neutral-900">{REPORTS[name].title}</span>
              <span className="text-[13px] text-neutral-500">{REPORTS[name].hint}</span>
            </span>
            <ChevronRight className="size-4 text-neutral-500" />
          </Link>
        ))}
      </FinanceCard>
    </FinanceShell>
  );
}

type Loc = { id: number; name: string };

export function ReportView({ name, accountId: initialAccount }: { name: ReportName; accountId?: number }) {
  const meta = REPORTS[name];
  const router = useRouter();
  const [month, setMonth] = useState(monthOf(new Date()));
  const asOfParam = useSearchParams().get("asOf");
  const [asOf, setAsOf] = useState(asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) ? asOfParam : todayKey());
  const [accountId, setAccountId] = useState<number | undefined>(initialAccount);
  const { data: acData } = useGetLedgerAccountsQuery(undefined, { skip: name !== "general-ledger" });
  const args: LedgerReportArgs =
    meta.dated === "range" ? { name, ...monthRange(month), accountId } : { name, asOf };
  const skip = name === "general-ledger" && !accountId;
  const { data, isLoading, isError } = useGetLedgerReportQuery(args, { skip });

  const controls = (
    <>
      {name === "general-ledger" && (
        <Select
          className="min-w-56"
          value={accountId}
          onChange={(v) => {
            setAccountId(v);
            router.replace(`/finance/reports/general-ledger?accountId=${v}`);
          }}
          options={(acData?.accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))}
          placeholder="選科目"
        />
      )}
      {meta.dated === "range" ? (
        <MonthSwitcher month={month} onChange={setMonth} />
      ) : (
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          截至
          <input type="date" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900" />
        </label>
      )}
    </>
  );

  let body: ReactNode;
  if (skip) body = <EmptyState kind="inline" title="先選一個科目" />;
  else if (isLoading) body = <Skeleton className="h-96 rounded-2xl" />;
  else if (isError || !data) body = <EmptyState kind="inline" title="讀不到報表，請稍後再試" />;
  else body = <ReportBody name={name} data={data as Record<string, unknown>} />;

  return (
    <FinanceShell title={meta.title} guide="reports" crumb={{ href: "/finance/reports", label: "報表" }} actions={controls}>
      {body}
    </FinanceShell>
  );
}

function ReportBody({ name, data }: { name: ReportName; data: Record<string, unknown> }) {
  const locations = (data.locations as Loc[]) ?? [];
  switch (name) {
    case "pnl":
      return <PnlTable pnl={data as unknown as Pnl} locations={locations} />;
    case "balance-sheet":
      return <BalanceSheetTable bs={data as unknown as BalanceSheet} locations={locations} />;
    case "cash-flow":
      return <CashFlowTable cf={data as unknown as CashFlow} locations={locations} />;
    case "deferred-revenue":
      return <DeferredView d={data as unknown as Omit<DeferredRollforward, "cards"> & { cards: { cardId: number; balance: number; name: string }[] }} />;
    case "receivables":
      return <ReceivablesView data={data as unknown as ReceivablesData} locations={locations} />;
    case "payables":
      return <PayablesView data={data as unknown as PayablesData} />;
    case "lessons":
      return <LessonsView data={data as unknown as LessonsData} />;
    case "trial-balance":
      return <TrialBalanceView data={data as unknown as { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }} />;
    case "general-ledger":
      return <GeneralLedgerView data={data as unknown as GlData} locations={locations} />;
  }
}

// ── 共用表格

const th = "px-4 py-2.5 text-right text-xs font-medium text-neutral-500 first:text-left";
const td = "px-4 py-2.5 text-right tabular-nums first:text-left";

function Table({ head, children, minWidth = 620 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <FinanceCard className="overflow-x-auto py-2">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-neutral-200">
            {head.map((h, i) => (
              <th key={i} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </FinanceCard>
  );
}

const GroupRow = ({ label, span }: { label: string; span: number }) => (
  <tr>
    <td colSpan={span} className="px-4 pb-1 pt-5 text-xs font-semibold tracking-wide text-neutral-600">
      {label}
    </td>
  </tr>
);

function LocRow({
  label,
  code,
  x,
  locations,
  tone,
  indent,
}: {
  label: ReactNode;
  code?: string;
  x: { byLocation: Record<number, number>; total: number };
  locations: Loc[];
  tone?: "sub" | "key" | "net" | "muted";
  indent?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-neutral-100",
        tone === "sub" && "border-t border-t-neutral-300 bg-neutral-50 font-semibold",
        tone === "key" && "bg-neutral-50 font-bold",
        tone === "net" && "border-t-2 border-t-neutral-900 border-b-0 text-base font-bold",
        tone === "muted" && "text-neutral-500",
      )}
    >
      <td className={cn(td, indent && "pl-9")}>
        {code && <span className="mr-2 text-xs text-neutral-500">{code}</span>}
        {label}
      </td>
      {locations.length > 1 && locations.map((l) => (
        <td key={l.id} className={td}>
          <Amount cents={x.byLocation[l.id] ?? 0} blankZero={!tone} />
        </td>
      ))}
      <td className={td}>
        <Amount cents={x.total} blankZero={!tone} />
      </td>
    </tr>
  );
}

const locHead = (locations: Loc[]) => [...(locations.length > 1 ? locations.map((l) => l.name) : []), locations.length > 1 ? "全教室" : "金額"];

function PnlTable({ pnl, locations }: { pnl: Pnl; locations: Loc[] }) {
  const span = locHead(locations).length + 1;
  const section = (label: string, s: PnlSection, subLabel: string) => (
    <>
      <GroupRow label={label} span={span} />
      {s.lines.map((l) => <LocRow key={l.accountId} code={l.code} label={l.name} x={l} locations={locations} />)}
      <LocRow label={subLabel} x={s} locations={locations} tone="sub" />
    </>
  );
  return (
    <Table head={["科目", ...locHead(locations)]}>
      {section("收入", pnl.income, "收入合計")}
      {section("上課成本", pnl.directCosts, "上課成本合計")}
      <LocRow label="毛利（原本的「進公積金」）" x={pnl.grossProfit} locations={locations} tone="key" />
      {pnl.expenses.lines.length > 0 && section("營業費用", pnl.expenses, "營業費用合計")}
      <LocRow label="淨利" x={pnl.netIncome} locations={locations} tone="net" />
    </Table>
  );
}

const BS_LABEL: Record<string, string> = { "IB+": "分部往來：別的分部欠我", "IB-": "分部往來：我欠別的分部" };

function BalanceSheetTable({ bs, locations }: { bs: BalanceSheet; locations: Loc[] }) {
  const span = locHead(locations).length + 1;
  const cash = bs.assets.filter((l) => l.group === "CASH");
  const cashTotal = {
    byLocation: Object.fromEntries(locations.map((l) => [l.id, cash.reduce((s, c) => s + (c.byLocation[l.id] ?? 0), 0)])),
    total: cash.reduce((s, c) => s + c.total, 0),
  };
  const row = (l: BsLine) => <LocRow key={l.key} code={l.code} label={BS_LABEL[l.key] ?? l.label} x={l} locations={locations} />;
  return (
    <div className="flex flex-col gap-3">
      <Table head={["科目", ...locHead(locations)]}>
        <GroupRow label="資產" span={span} />
        {cash.length > 0 && <LocRow code="1111" label="現金（資金帳戶）" x={cashTotal} locations={locations} />}
        {cash.map((l) => <LocRow key={l.key} label={l.label} x={l} locations={locations} indent tone="muted" />)}
        {bs.assets.filter((l) => l.group !== "CASH").map(row)}
        <LocRow label="資產合計" x={bs.totals.assets} locations={locations} tone="sub" />
        <GroupRow label="負債" span={span} />
        {bs.liabilities.map(row)}
        <LocRow label="負債合計" x={bs.totals.liabilities} locations={locations} tone="sub" />
        <GroupRow label="權益" span={span} />
        {bs.equity.map(row)}
        <LocRow label="權益合計" x={bs.totals.equity} locations={locations} tone="sub" />
      </Table>
      <div
        role="status"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm",
          bs.balanced ? "bg-primary-100 text-primary-900" : "bg-danger-50 text-danger-700",
        )}
      >
        {bs.balanced ? <CheckCircle2 className="size-[18px]" /> : <TriangleAlert className="size-[18px]" />}
        {bs.balanced ? "每個分部都平衡：資產 ＝ 負債 ＋ 權益" : "不平衡，請到結帳頁跑帳本健康檢查"}
      </div>
    </div>
  );
}

const CF_LABEL: Record<string, string> = {
  OPENING: "期初分錄",
  TUITION: "收學費",
  DROP_IN: "收單堂",
  REFUND: "退費",
  PAYOUT: "付老師、場地、業主",
  VENUE_PACK: "買次數包",
  EXPENSE: "支出",
  OWNER: "老闆放錢／拿錢",
  TRANSFER: "帳戶之間轉帳",
  CASH_COUNT: "盤點差額",
  MANUAL: "手動分錄",
  OTHER: "其他",
};

function CashFlowTable({ cf, locations }: { cf: CashFlow; locations: Loc[] }) {
  return (
    <Table head={["", ...locHead(locations)]}>
      <LocRow label="期初現金" x={cf.opening} locations={locations} tone="sub" />
      {cf.flows.map((f) => <LocRow key={f.category} label={CF_LABEL[f.category] ?? f.category} x={f} locations={locations} />)}
      <LocRow label="期末現金" x={cf.closing} locations={locations} tone="net" />
    </Table>
  );
}

function DeferredView({ d }: { d: Omit<DeferredRollforward, "cards"> & { cards: { cardId: number; balance: number; name: string }[] } }) {
  const rows: [string, number][] = [
    ["期初", d.opening],
    ["賣出", d.sold],
    ["上課認列", -d.recognized],
    ["到期、退費、轉出", -d.closed],
  ];
  return (
    <div className="flex flex-col gap-3">
      <Table head={["", "金額"]} minWidth={320}>
        {rows.map(([l, v]) => (
          <tr key={l} className="border-b border-neutral-100">
            <td className={td}>{l}</td>
            <td className={td}><Amount cents={v} /></td>
          </tr>
        ))}
        <tr className="border-t-2 border-neutral-900 font-bold">
          <td className={td}>期末</td>
          <td className={td}><Amount cents={d.closing} /></td>
        </tr>
      </Table>
      <Table head={["卡", "還欠的課"]} minWidth={320}>
        {d.cards.map((c) => (
          <tr key={c.cardId} className="border-b border-neutral-100">
            <td className={td}>{c.name}</td>
            <td className={td}><Amount cents={c.balance} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

type ReceivablesData = {
  items: { partyType: string; partyId: number; locationId: number; balance: number; since: string; ageDays: number; name: string; bucket: string }[];
  buckets: Record<string, number>;
  total: number;
};
function ReceivablesView({ data, locations }: { data: ReceivablesData; locations: Loc[] }) {
  if (data.items.length === 0) return <EmptyState kind="inline" title="沒有還沒付的錢" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {(["0-30", "31-60", "60+"] as const).map((b) => (
          <FinanceCard key={b} className="flex flex-col gap-1 px-4 py-3">
            <span className="text-[13px] text-neutral-500">{b === "60+" ? "超過 60 天" : `${b} 天`}</span>
            <Amount cents={data.buckets[b] ?? 0} dollar className={cn("text-xl font-bold", b === "60+" && (data.buckets[b] ?? 0) > 0 && "text-danger-700")} />
          </FinanceCard>
        ))}
      </div>
      <Table head={["誰", "分部", "從哪天", "天數", "金額"]}>
        {data.items.map((i) => (
          <tr key={`${i.partyType}:${i.partyId}:${i.locationId}`} className="border-b border-neutral-100">
            <td className={td}>{i.name}</td>
            <td className={td}>{locations.find((l) => l.id === i.locationId)?.name}</td>
            <td className={td}>{i.since.replaceAll("-", "/")}</td>
            <td className={td}>{i.ageDays}</td>
            <td className={td}><Amount cents={i.balance} /></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

type PayablesData = { items: { partyType: string; partyId: number; name: string; payable: number; held: number }[]; totalPayable: number; totalHeld: number };
function PayablesView({ data }: { data: PayablesData }) {
  if (data.items.length === 0) return <EmptyState kind="inline" title="沒有要付的錢" />;
  return (
    <Table head={["對象", "可以發", "等學生付款"]} minWidth={420}>
      {data.items.map((i) => (
        <tr key={`${i.partyType}:${i.partyId}`} className="border-b border-neutral-100">
          <td className={td}>
            {i.partyType === "TEACHER" ? <Link className="text-primary-800 hover:underline" href={`/finance/payouts/teachers/${i.partyId}`}>{i.name}</Link> : i.name}
          </td>
          <td className={td}><Amount cents={i.payable} blankZero /></td>
          <td className={td}><Amount cents={i.held} blankZero /></td>
        </tr>
      ))}
      <tr className="border-t-2 border-neutral-900 font-bold">
        <td className={td}>合計</td>
        <td className={td}><Amount cents={data.totalPayable} /></td>
        <td className={td}><Amount cents={data.totalHeld} /></td>
      </tr>
    </Table>
  );
}

type LessonsData = { lessons: { lessonId: number; name: string; periods: number; attendance: number; revenue: number; teacher: number; venue: number; gross: number }[] };
function LessonsView({ data }: { data: LessonsData }) {
  if (data.lessons.length === 0) return <EmptyState kind="inline" title="這段期間沒有點名的課" />;
  return (
    <Table head={["課", "堂數", "人次", "收入", "老師", "場地", "毛利"]} minWidth={720}>
      {data.lessons.map((l) => (
        <tr key={l.lessonId} className="border-b border-neutral-100">
          <td className={td}><Link className="text-primary-800 hover:underline" href={`/lessons/${l.lessonId}`}>{l.name}</Link></td>
          <td className={td}>{l.periods}</td>
          <td className={td}>{l.attendance}</td>
          <td className={td}><Amount cents={l.revenue} /></td>
          <td className={td}><Amount cents={l.teacher} /></td>
          <td className={td}><Amount cents={l.venue} /></td>
          <td className={cn(td, "font-semibold")}><Amount cents={l.gross} /></td>
        </tr>
      ))}
    </Table>
  );
}

function TrialBalanceView({ data }: { data: { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number } }) {
  return (
    <Table head={["科目", "借方", "貸方"]} minWidth={480}>
      {data.rows.map((r) => (
        <tr key={r.accountId} className="border-b border-neutral-100">
          <td className={td}>
            <Link href={`/finance/reports/general-ledger?accountId=${r.accountId}`} className="hover:underline">
              <span className="mr-2 text-xs text-neutral-500">{r.code}</span>
              {r.name}
            </Link>
          </td>
          <td className={td}><Amount cents={r.debit} blankZero /></td>
          <td className={td}><Amount cents={r.credit} blankZero /></td>
        </tr>
      ))}
      <tr className="border-t-2 border-neutral-900 font-bold">
        <td className={td}>合計</td>
        <td className={td}><Amount cents={data.totalDebit} /></td>
        <td className={td}><Amount cents={data.totalCredit} /></td>
      </tr>
    </Table>
  );
}

type GlData = {
  account: { name: string; code: string };
  opening: number;
  closing: number;
  lines: { entryId: number; date: string; amount: number; running: number; locationId: number; sourceType: string | null; entryKind: string; party: string | null }[];
};
const SOURCE_LABEL: Record<string, string> = {
  CARD: "課卡",
  PERIOD: "上課",
  EXPENSE: "支出",
  VENUE_PACK: "次數包",
  PAYOUT: "付款",
  MONEY_TRANSFER: "轉帳",
  OWNER_TXN: "業主",
  CASH_COUNT: "盤點",
};
function GeneralLedgerView({ data, locations }: { data: GlData; locations: Loc[] }) {
  return (
    <Table head={["日期", "摘要", "分部", "借", "貸", "餘額"]} minWidth={720}>
      <tr className="border-b border-neutral-100 bg-neutral-50 font-semibold">
        <td className={td} colSpan={5}>期初</td>
        <td className={td}><Amount cents={data.opening} /></td>
      </tr>
      {data.lines.map((l, i) => (
        <tr key={`${l.entryId}:${i}`} className="border-b border-neutral-100">
          <td className={td}>{l.date.slice(5).replace("-", "/")}</td>
          <td className={td}>
            {l.sourceType ? SOURCE_LABEL[l.sourceType] ?? l.sourceType : l.entryKind === "OPENING" ? "期初" : l.entryKind === "REVERSAL" ? "沖銷" : "手動分錄"}
            {l.party && <span className="ml-1.5 text-neutral-500">· {l.party}</span>}
          </td>
          <td className={td}>{locations.find((x) => x.id === l.locationId)?.name}</td>
          <td className={td}>{l.amount > 0 && <Amount cents={l.amount} />}</td>
          <td className={td}>{l.amount < 0 && <Amount cents={-l.amount} />}</td>
          <td className={td}><Amount cents={l.running} /></td>
        </tr>
      ))}
      <tr className="border-t-2 border-neutral-900 font-bold">
        <td className={td} colSpan={5}>期末</td>
        <td className={td}><Amount cents={data.closing} /></td>
      </tr>
    </Table>
  );
}
