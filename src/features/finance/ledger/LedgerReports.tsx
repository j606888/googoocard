"use client";

// 財務 v2 報表（P4：最陽春的表格，先把數字做對；設計稿在 P6）。docs/finance-v2/05 §3。
import Link from "next/link";
import { useState, type ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import Select from "@/components/Select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetLedgerReportQuery, type LedgerReportArgs } from "@/store/slices/ledger";
import type { ReportName } from "@/service/ledger/reports";

export const REPORT_TITLES: Record<ReportName, { title: string; hint: string; dated: "range" | "asOf" }> = {
  pnl: { title: "損益表", hint: "這段期間賺多少：收入 − 老師與場地 − 營業費用", dated: "range" },
  "balance-sheet": { title: "資產負債表", hint: "某一天：有的 ＝ 欠的 ＋ 自己的", dated: "asOf" },
  "cash-flow": { title: "現金流量", hint: "錢從哪裡來、去了哪裡", dated: "range" },
  "deferred-revenue": { title: "預收餘額", hint: "欠學生還沒上的課：期初＋賣出−上課−關閉＝期末", dated: "range" },
  receivables: { title: "應收帳齡", hint: "還沒付錢的卡與單堂", dated: "asOf" },
  payables: { title: "應付明細", hint: "該付給老師、場地、業主的錢", dated: "asOf" },
  lessons: { title: "課程獲利", hint: "每門課的收入、老師、場地、毛利", dated: "range" },
  "trial-balance": { title: "試算表", hint: "每個科目的借貸，給記帳士", dated: "asOf" },
  "general-ledger": { title: "總分類帳", hint: "某個科目的每一筆", dated: "range" },
};

const yuan = (cents: number) => formatMoney(cents / 100);
const Num = ({ v, strong }: { v: number; strong?: boolean }) => (
  <td className={`py-1.5 pl-3 text-right tabular-nums ${v < 0 ? "text-red-600" : ""} ${strong ? "font-semibold" : ""}`}>{yuan(v)}</td>
);

type Loc = { id: number; name: string };
type ByLoc = { byLocation: Record<number, number>; total: number };

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-[13px] text-neutral-500">{head}</thead>
        <tbody className="[&_tr]:border-t [&_tr]:border-neutral-100 [&_td]:px-3">{children}</tbody>
      </table>
    </div>
  );
}

const LocHead = ({ locs, first }: { locs: Loc[]; first: string }) => (
  <tr>
    <th className="px-3 py-2 font-normal">{first}</th>
    {locs.map((l) => (
      <th key={l.id} className="px-3 py-2 text-right font-normal">{l.name}</th>
    ))}
    <th className="px-3 py-2 text-right font-normal">全教室</th>
  </tr>
);

const LocRow = ({ label, v, locs, strong }: { label: ReactNode; v: ByLoc; locs: Loc[]; strong?: boolean }) => (
  <tr>
    <td className={`py-1.5 ${strong ? "font-semibold" : ""}`}>{label}</td>
    {locs.map((l) => <Num key={l.id} v={v.byLocation[l.id] ?? 0} strong={strong} />)}
    <Num v={v.total} strong={strong} />
  </tr>
);

// 報表 JSON 依名稱不同，P6 換成正式畫面時再逐一定型。
function Body({ name, data }: { name: ReportName; data: any }) {
  const locs: Loc[] = data.locations ?? [];
  switch (name) {
    case "pnl": {
      const section = (title: string, s: any) => (
        <>
          {s.lines.map((l: any) => <LocRow key={l.accountId} label={<span className="pl-3">{l.name}</span>} v={l} locs={locs} />)}
          <LocRow label={title} v={s} locs={locs} strong />
        </>
      );
      return (
        <Table head={<LocHead locs={locs} first="科目" />}>
          {section("收入合計", data.income)}
          {section("老師與場地", data.directCosts)}
          <LocRow label="毛利（進公積金的錢）" v={data.grossProfit} locs={locs} strong />
          {section("營業費用合計", data.expenses)}
          <LocRow label="淨利" v={data.netIncome} locs={locs} strong />
        </Table>
      );
    }
    case "balance-sheet":
      return (
        <div className="flex flex-col gap-2">
          <Table head={<LocHead locs={locs} first="" />}>
            {data.assets.map((l: any) => <LocRow key={l.key} label={l.label} v={l} locs={locs} />)}
            <LocRow label="資產合計" v={data.totals.assets} locs={locs} strong />
            {data.liabilities.map((l: any) => <LocRow key={l.key} label={l.label} v={l} locs={locs} />)}
            <LocRow label="負債合計" v={data.totals.liabilities} locs={locs} strong />
            {data.equity.map((l: any) => <LocRow key={l.key} label={l.label} v={l} locs={locs} />)}
            <LocRow label="權益合計" v={data.totals.equity} locs={locs} strong />
          </Table>
          <p className="text-sm text-neutral-500">{data.balanced ? "✓ 每個分部都平衡：資產 ＝ 負債 ＋ 權益" : "⚠ 不平衡，請到設定按「重新檢查帳本」"}</p>
        </div>
      );
    case "cash-flow": {
      const label: Record<string, string> = {
        OPENING: "期初", TUITION: "收學費", DROP_IN: "收單堂", REFUND: "退費", PAYOUT: "付款", VENUE_PACK: "買次數包", EXPENSE: "支出", TRANSFER: "帳戶間轉帳", OTHER: "其他",
      };
      return (
        <Table head={<LocHead locs={locs} first="" />}>
          <LocRow label="期初現金" v={data.opening} locs={locs} strong />
          {data.flows.map((f: any) => <LocRow key={f.category} label={label[f.category] ?? f.category} v={f} locs={locs} />)}
          <LocRow label="期末現金" v={data.closing} locs={locs} strong />
        </Table>
      );
    }
    case "deferred-revenue":
      return (
        <div className="flex flex-col gap-3">
          <Table head={<tr><th className="px-3 py-2 font-normal">預收</th><th className="px-3 py-2 text-right font-normal">金額</th></tr>}>
            {[["期初", data.opening], ["＋ 賣出", data.sold], ["− 上課認列", data.recognized], ["− 到期、退費、轉出", data.closed]].map(([l, v]) => (
              <tr key={l as string}><td className="py-1.5">{l}</td><Num v={v as number} /></tr>
            ))}
            <tr><td className="py-1.5 font-semibold">期末</td><Num v={data.closing} strong /></tr>
          </Table>
          <Table head={<tr><th className="px-3 py-2 font-normal">卡</th><th className="px-3 py-2 text-right font-normal">還沒上的價值</th></tr>}>
            {data.cards.map((c: any) => <tr key={c.cardId}><td className="py-1.5">{c.name}</td><Num v={c.balance} /></tr>)}
          </Table>
        </div>
      );
    case "receivables":
      return (
        <Table head={<tr><th className="px-3 py-2 font-normal">誰</th><th className="px-3 py-2 font-normal">從</th><th className="px-3 py-2 text-right font-normal">天數</th><th className="px-3 py-2 text-right font-normal">金額</th></tr>}>
          {data.items.map((i: any) => (
            <tr key={`${i.partyType}${i.partyId}`}>
              <td className="py-1.5">{i.name}</td><td className="py-1.5">{i.since}</td>
              <td className={`py-1.5 text-right tabular-nums ${i.bucket === "60+" ? "text-red-600" : ""}`}>{i.ageDays}</td><Num v={i.balance} />
            </tr>
          ))}
          <tr><td className="py-1.5 font-semibold" colSpan={3}>合計（0–30 天 {yuan(data.buckets["0-30"])}・31–60 天 {yuan(data.buckets["31-60"])}・60 天以上 {yuan(data.buckets["60+"])}）</td><Num v={data.total} strong /></tr>
        </Table>
      );
    case "payables":
      return (
        <Table head={<tr><th className="px-3 py-2 font-normal">付給</th><th className="px-3 py-2 text-right font-normal">可以發</th><th className="px-3 py-2 text-right font-normal">待學生付款</th></tr>}>
          {data.items.map((i: any) => <tr key={`${i.partyType}${i.partyId}`}><td className="py-1.5">{i.name}</td><Num v={i.payable} /><Num v={i.held} /></tr>)}
          <tr><td className="py-1.5 font-semibold">合計</td><Num v={data.totalPayable} strong /><Num v={data.totalHeld} strong /></tr>
        </Table>
      );
    case "lessons":
      return (
        <Table head={<tr>{["課", "堂數", "人次", "收入", "老師", "場地", "毛利"].map((h, i) => <th key={h} className={`px-3 py-2 font-normal ${i ? "text-right" : ""}`}>{h}</th>)}</tr>}>
          {data.lessons.map((l: any) => (
            <tr key={l.lessonId}>
              <td className="py-1.5">{l.name}</td>
              <td className="py-1.5 text-right tabular-nums">{l.periods}</td>
              <td className="py-1.5 text-right tabular-nums">{l.attendance}</td>
              <Num v={l.revenue} /><Num v={l.teacher} /><Num v={l.venue} /><Num v={l.gross} strong />
            </tr>
          ))}
        </Table>
      );
    case "trial-balance":
      return (
        <Table head={<tr>{["代碼", "科目", "借方", "貸方"].map((h, i) => <th key={h} className={`px-3 py-2 font-normal ${i > 1 ? "text-right" : ""}`}>{h}</th>)}</tr>}>
          {data.rows.map((r: any) => (
            <tr key={r.accountId}>
              <td className="py-1.5 font-mono text-xs text-neutral-500">{r.code}</td>
              <td className="py-1.5"><Link className="underline-offset-2 hover:underline" href={`/finance/reports/general-ledger?accountId=${r.accountId}`}>{r.name}</Link></td>
              <Num v={Math.max(0, r.balance)} /><Num v={Math.max(0, -r.balance)} />
            </tr>
          ))}
          <tr><td /><td className="py-1.5 font-semibold">合計</td><Num v={data.totalDebit} strong /><Num v={data.totalCredit} strong /></tr>
        </Table>
      );
    case "general-ledger":
      return (
        <Table head={<tr>{["日期", "對象", "來源", "金額", "累計"].map((h, i) => <th key={h} className={`px-3 py-2 font-normal ${i > 2 ? "text-right" : ""}`}>{h}</th>)}</tr>}>
          <tr><td className="py-1.5" colSpan={4}>期初 · {data.account.code} {data.account.name}</td><Num v={data.opening} strong /></tr>
          {data.lines.map((l: any, i: number) => (
            <tr key={`${l.entryId}-${i}`}>
              <td className="py-1.5 tabular-nums">{l.date}</td>
              <td className="py-1.5">{l.party ?? "—"}</td>
              <td className="py-1.5 text-neutral-500">{l.sourceType ?? (l.entryKind === "OPENING" ? "期初" : "手動")}</td>
              <Num v={l.amount * (["ASSET", "EXPENSE"].includes(data.account.type) ? 1 : -1)} /><Num v={l.running} />
            </tr>
          ))}
        </Table>
      );
  }
}

export function LedgerReportsIndex() {
  return (
    <div className="flex flex-col gap-3 p-4 lg:p-6">
      <h1 className="text-lg font-semibold text-neutral-900">報表</h1>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(REPORT_TITLES) as ReportName[]).filter((n) => n !== "general-ledger").map((n) => (
          <li key={n}>
            <Link href={`/finance/reports/${n}`} className="block rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-400">
              <span className="block font-medium text-neutral-900">{REPORT_TITLES[n].title}</span>
              <span className="block text-sm text-neutral-500">{REPORT_TITLES[n].hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LedgerReportView({ name, accountId }: { name: ReportName; accountId?: number }) {
  const meta = REPORT_TITLES[name];
  const today = toTaipeiDateKey(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [locationId, setLocationId] = useState<number | undefined>(undefined);
  const args: LedgerReportArgs =
    meta.dated === "range" ? { name, from, to, locationId, accountId } : { name, asOf: to, locationId, accountId };
  const { data, isLoading, isError } = useGetLedgerReportQuery(args);
  const locs = ((data as { locations?: Loc[] } | undefined)?.locations ?? []);
  const perLocationFilter = !["pnl", "balance-sheet", "cash-flow"].includes(name);

  return (
    <div className="flex flex-col gap-3 p-4 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <Link href="/finance/reports" className="text-sm text-neutral-500">← 報表</Link>
          <h1 className="text-lg font-semibold text-neutral-900">{meta.title}</h1>
          <p className="text-sm text-neutral-500">{meta.hint}</p>
        </div>
        {meta.dated === "range" && (
          <label className="flex flex-col text-xs text-neutral-500">從<input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-900" /></label>
        )}
        <label className="flex flex-col text-xs text-neutral-500">{meta.dated === "range" ? "到" : "截至"}<input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1 text-sm text-neutral-900" /></label>
        {perLocationFilter && locs.length > 1 && (
          <Select
            id="report-location"
            aria-label="分部"
            size="sm"
            className="w-auto"
            value={locationId ?? 0}
            onChange={(v) => setLocationId(v === 0 ? undefined : v)}
            options={[{ value: 0, label: "全教室" }, ...locs.map((l) => ({ value: l.id, label: l.name }))]}
          />
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-2xl" />
      ) : isError || !data ? (
        <EmptyState kind="inline" title="讀不到報表，請稍後再試" />
      ) : (
        <Body name={name} data={data} />
      )}
    </div>
  );
}
