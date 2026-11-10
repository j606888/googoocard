"use client";

// 資金帳戶與盤點（docs/finance-v2/05 §3.9；設計稿「資金帳戶與盤點」）。
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Drawer from "@/components/Drawer";
import Field, { FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { monthOf } from "@/domains/finance/months";
import { monthRange, type CashFlow } from "@/domains/ledger/reports";
import { cn } from "@/lib/utils";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useCreateCashCountMutation,
  useCreateMoneyAccountMutation,
  useGetLedgerReportQuery,
  useGetMoneyAccountsQuery,
  type MoneyAccountView,
} from "@/store/slices/ledger";
import MonthSwitcher from "../MonthSwitcher";
import { financeErrorText } from "../financeUi";
import { useFinanceMembers } from "../useFinanceForm";
import { useFinanceRole } from "../useCanSettle";
import { Amount, FinanceCard, FinanceShell, amountText, parseYuan } from "./ui";
import { CF_LABEL, mergeCashFlowOpening } from "./Reports";

const SOURCE: Record<string, string> = {
  CARD: "收學費",
  PERIOD: "收單堂",
  EXPENSE: "支出",
  VENUE_PACK: "買次數包",
  PAYOUT: "付款",
  MONEY_TRANSFER: "轉帳",
  OWNER_TXN: "老闆放錢／拿錢",
  CASH_COUNT: "盤點差額",
};

export default function Accounts() {
  const { canSettle, meId } = useFinanceRole();
  const { data, isLoading, isError } = useGetMoneyAccountsQuery();
  const { data: locData } = useGetLocationsQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [month, setMonth] = useState(monthOf(new Date()));
  const accounts = (data?.accounts ?? []).filter((a) => !a.archivedAt || a.balance !== 0);
  const current = accounts.find((a) => a.id === selected) ?? accounts.find((a) => a.holderUserId === meId) ?? accounts[0];
  const locName = (id: number) => locData?.locations.find((l) => l.id === id)?.name ?? "";

  return (
    <FinanceShell
      guide="accounts"
      title="資金帳戶"
      actions={
        <>
          <MonthSwitcher month={month} onChange={setMonth} />
          {canSettle && <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>新增資金帳戶</Button>}
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : isError ? (
        <EmptyState kind="inline" title="讀不到資金帳戶" />
      ) : !current ? (
        <EmptyState kind="inline" title="還沒有資金帳戶" />
      ) : (
        <div className="flex flex-col gap-4">
        <MonthFlow month={month} />
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex w-full flex-col gap-2 lg:w-72">
            {accounts.map((a) => {
              const active = a.id === current.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(a.id)}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border bg-white px-4 py-3.5 text-left",
                    active ? "border-primary-700 ring-1 ring-primary-700" : "border-neutral-200 hover:border-neutral-300",
                  )}
                >
                  <span className="text-sm font-semibold">{a.name}</span>
                  <span className="text-xs text-neutral-500">{locName(a.locationId)} · {a.code}</span>
                  <Amount cents={a.balance} dollar className="mt-1 text-xl font-bold" />
                  <span className={cn("text-xs", a.lastCount ? "text-neutral-500" : "text-warning-900")}>
                    {a.lastCount ? `${a.lastCount.date.slice(5).replace("-", "/")} 盤點過` : "還沒盤點過"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
            <CashCount key={current.id} account={current} canCount={canSettle || current.holderUserId === meId} />
            <Movements account={current} month={month} />
          </div>
        </div>
        </div>
      )}
      <AddAccountDrawer open={adding} onClose={() => setAdding(false)} />
    </FinanceShell>
  );
}

function CashCount({ account, canCount }: { account: MoneyAccountView; canCount: boolean }) {
  const [counted, setCounted] = useState("");
  const [count, { isLoading }] = useCreateCashCountMutation();
  const cents = parseYuan(counted);
  const diff = cents === null ? null : cents - account.balance;
  if (!canCount) return null;
  const submit = async () => {
    try {
      const r = await count({ moneyAccountId: account.id, counted: cents! }).unwrap();
      toast.success(r.difference === 0 ? "盤點完成，剛好" : `盤點完成，差 ${amountText(r.difference, { dollar: true })}`);
      setCounted("");
    } catch (e) {
      toast.error(financeErrorText(e));
    }
  };
  return (
    <FinanceCard className="flex flex-col gap-3.5 px-5 py-4" aria-label="盤點">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">盤點 {account.name}</h2>
        <InfoTip label="說明">數一數手上（或戶頭裡屬於教室）的錢。跟帳上不一樣的差額會記成「現金短溢」，帳上餘額就會等於實際數到的。</InfoTip>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 text-[13px] text-neutral-600">
          帳上
          <Amount cents={account.balance} dollar className="py-2 text-xl font-semibold text-neutral-900" />
        </div>
        <Field label="實際數到" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} className="w-36" />
        <div className="flex flex-col gap-1.5 text-[13px] text-neutral-600">
          差額
          <span className={cn("py-2 text-xl font-semibold tabular-nums", diff !== null && diff < 0 ? "text-danger-700" : "text-neutral-900")}>
            {diff === null ? "—" : diff === 0 ? "剛好" : `${amountText(diff, { dollar: true })} ${diff < 0 ? "短少" : "多出"}`}
          </span>
        </div>
        <Button className="ml-auto" disabled={cents === null} isLoading={isLoading} onClick={submit}>確認盤點</Button>
      </div>
    </FinanceCard>
  );
}

type Gl = { opening: number; closing: number; lines: { entryId: number; date: string; amount: number; running: number; sourceType: string | null; entryKind: string; party: string | null }[] };

/** 這個月全教室的錢從哪來、去哪（原本的「現金流量」報表），精簡成兩欄。 */
function MonthFlow({ month }: { month: string }) {
  const { data, isLoading } = useGetLedgerReportQuery({ name: "cash-flow", ...monthRange(month) });
  if (isLoading) return <Skeleton className="h-28 rounded-2xl" />;
  if (!data) return null;
  const cf = mergeCashFlowOpening(data as CashFlow);
  const flows = cf.flows.filter((f) => f.total !== 0);
  const ins = flows.filter((f) => f.total > 0);
  const outs = flows.filter((f) => f.total < 0);
  const list = (title: string, xs: typeof flows) => (
    <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
      <span className="text-[13px] text-neutral-500">{title}</span>
      {xs.length === 0 ? (
        <span className="text-sm text-neutral-400">沒有</span>
      ) : (
        xs.map((f) => (
          <div key={f.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-700">{CF_LABEL[f.category] ?? f.category}</span>
            <Amount cents={Math.abs(f.total)} dollar className="font-medium" />
          </div>
        ))
      )}
    </div>
  );
  return (
    <FinanceCard className="flex flex-col gap-3 px-5 py-4" aria-label="這個月的錢">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">{Number(month.slice(5))} 月的錢</h2>
        <InfoTip label="說明">全部資金帳戶加起來：月初有多少、這個月進來和出去的，月底剩多少。帳戶之間轉來轉去不算。</InfoTip>
        <span className="ml-auto text-[13px] text-neutral-500 tabular-nums">
          月初 <Amount cents={cf.opening.total} dollar /> → 月底 <Amount cents={cf.closing.total} dollar className="font-semibold text-neutral-900" />
        </span>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {list("進來", ins)}
        {list("出去", outs)}
      </div>
    </FinanceCard>
  );
}

function Movements({ account, month }: { account: MoneyAccountView; month: string }) {
  const { data, isLoading } = useGetLedgerReportQuery({ name: "general-ledger", accountId: account.accountId, ...monthRange(month) });
  const gl = data as Gl | undefined;
  const lines = [...(gl?.lines ?? [])].reverse();
  return (
    <FinanceCard className="overflow-x-auto pb-2 pt-3.5" aria-label="明細">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2">
        <h2 className="text-base font-semibold">明細</h2>
      </div>
      {isLoading ? (
        <Skeleton className="mx-5 h-40 rounded-xl" />
      ) : lines.length === 0 ? (
        <p className="px-5 py-4 text-sm text-neutral-500">這個月沒有進出</p>
      ) : (
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs text-neutral-500">
              <th scope="col" className="px-5 py-2 text-left font-medium">日期</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">摘要</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">金額</th>
              <th scope="col" className="px-5 py-2 text-right font-medium">餘額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.entryId}:${i}`} className="border-b border-neutral-100">
                <td className="px-5 py-2.5 tabular-nums">{l.date.slice(5).replace("-", "/")}</td>
                <td className="px-4 py-2.5">
                  {l.sourceType ? SOURCE[l.sourceType] ?? l.sourceType : l.entryKind === "OPENING" ? "期初" : "手動分錄"}
                  {l.party && <span className="text-neutral-500"> · {l.party}</span>}
                </td>
                <td className="px-4 py-2.5 text-right"><Amount cents={l.amount} /></td>
                <td className="px-5 py-2.5 text-right"><Amount cents={l.running} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FinanceCard>
  );
}

export function AddAccountDrawer({ open, onClose, holderUserId }: { open: boolean; onClose: () => void; holderUserId?: number }) {
  const { options } = useFinanceMembers();
  const { data: locData } = useGetLocationsQuery();
  const [create, { isLoading }] = useCreateMoneyAccountMutation();
  const [picked, setHolder] = useState<number | null>(null);
  const holder = picked ?? holderUserId ?? null;
  const [loc, setLoc] = useState<number | null>(null);
  const [kind, setKind] = useState<"CASH" | "BANK" | "EWALLET">("CASH");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    try {
      await create({ holderUserId: holder!, locationId: loc!, kind, ...(name.trim() ? { name: name.trim() } : {}) }).unwrap();
      toast.success("已新增資金帳戶");
      onClose();
    } catch (e) {
      setError(financeErrorText(e));
    }
  };
  return (
    <Drawer open={open} onClose={onClose} title="新增資金帳戶" submitText="新增" onSubmit={submit} isLoading={isLoading} disabled={!holder || !loc}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel hint="要先是保管人">誰保管</FieldLabel>
          <Select value={holder ?? undefined} onChange={setHolder} options={options} placeholder="選人" />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>錢屬於哪個分部</FieldLabel>
          <Select value={loc ?? undefined} onChange={setLoc} options={(locData?.locations ?? []).filter((l) => !l.archivedAt).map((l) => ({ value: l.id, label: l.name }))} placeholder="選分部" />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>種類</FieldLabel>
          <Select value={kind} onChange={setKind} options={[{ value: "CASH", label: "現金" }, { value: "BANK", label: "銀行帳戶" }, { value: "EWALLET", label: "電子錢包" }]} />
        </div>
        <Field label="名稱" hint="（選填）" placeholder="例：Sean 的郵局" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="text-sm text-danger-700">{error}</p>}
      </div>
    </Drawer>
  );
}
