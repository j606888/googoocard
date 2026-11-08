"use client";

// 結算與付款（docs/finance-v2/05 §3.8；設計稿「結算與付款」）。
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import { addDays } from "@/domains/ledger/lines";
import { cn } from "@/lib/utils";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useCreatePayoutRunMutation,
  useDeleteMoneyTransferMutation,
  useDeletePayoutMutation,
  useGetMoneyAccountsQuery,
  useGetPayoutRunsQuery,
  useMarkPayoutPaidMutation,
  useMarkTransferDoneMutation,
  type MoneyAccountView,
  type PayoutRun,
  type PayoutView,
  type TransferView,
} from "@/store/slices/ledger";
import { financeErrorText, todayKey } from "../financeUi";
import { useFinanceRole } from "../useCanSettle";
import { Amount, FinanceCard, FinanceShell, amountText } from "./ui";

const KIND: Record<string, string> = { TEACHER_PAYABLE: "老師報酬", VENUE_PAYABLE: "場地費", OWNER_PAYABLE: "代墊／分紅" };
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const lastMonthEnd = () => addDays(`${todayKey().slice(0, 7)}-01`, -1);

export default function Payouts() {
  const { canSettle } = useFinanceRole();
  const { data, isLoading, isError } = useGetPayoutRunsQuery();
  const { data: maData } = useGetMoneyAccountsQuery();
  const { data: locData } = useGetLocationsQuery();
  const [creating, setCreating] = useState(false);
  const [showOld, setShowOld] = useState(false);

  const runs = data?.runs ?? [];
  const current = runs[0];
  const accounts = maData?.accounts ?? [];
  const locName = (id: number) => locData?.locations.find((l) => l.id === id)?.name ?? "";

  const createButton = canSettle && (
    <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
      建立付款批次
    </Button>
  );

  return (
    <FinanceShell
      guide="payouts"
      title={current ? `${Number(current.asOf.slice(5, 7))} 月付款` : "結算與付款"}
      actions={
        <>
          {current && <Progress run={current} />}
          {createButton}
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : isError ? (
        <EmptyState kind="inline" title="讀不到付款資料，請稍後再試" />
      ) : !current ? (
        <EmptyState kind="inline" title="還沒有付款批次" />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="-mt-3 text-sm text-neutral-500">截至 {current.asOf.replaceAll("-", "/")} 可以發的錢</p>
          <RunBody run={current} accounts={accounts} locName={locName} canSettle={canSettle} />
          {runs.length > 1 && (
            <Button variant="link" size="sm" className="self-start" onClick={() => setShowOld((v) => !v)}>
              {showOld ? "收起之前的付款批次" : "之前的付款批次"}
            </Button>
          )}
          {showOld &&
            runs.slice(1).map((r) => (
              <div key={r.id} className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-neutral-700">截至 {r.asOf.replaceAll("-", "/")}</h2>
                <RunBody run={r} accounts={accounts} locName={locName} canSettle={canSettle} />
              </div>
            ))}
        </div>
      )}
      <CreateRunDrawer open={creating} onClose={() => setCreating(false)} />
    </FinanceShell>
  );
}

function Progress({ run }: { run: PayoutRun }) {
  const live = run.payouts.filter((p) => p.status !== "VOIDED");
  const liveT = run.transfers.filter((t) => t.status !== "VOIDED");
  return (
    <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 tabular-nums">
      已付 {live.filter((p) => p.status === "PAID").length} / {live.length}
      {liveT.length > 0 && ` · 轉平 ${liveT.filter((t) => t.status === "PAID").length} / ${liveT.length}`}
    </span>
  );
}

function RunBody({
  run,
  accounts,
  locName,
  canSettle,
}: {
  run: PayoutRun;
  accounts: MoneyAccountView[];
  locName: (id: number) => string;
  canSettle: boolean;
}) {
  const live = run.payouts.filter((p) => p.status !== "VOIDED");
  const transfers = run.transfers.filter((t) => t.status !== "VOIDED");
  if (live.length === 0 && transfers.length === 0) {
    return <FinanceCard className="px-5 py-6 text-sm text-neutral-500">這一批沒有要付的錢</FinanceCard>;
  }
  const groups = new Map<number | null, PayoutView[]>();
  for (const p of live) groups.set(p.fromMoneyAccountId, [...(groups.get(p.fromMoneyAccountId) ?? []), p]);
  const acct = (id: number | null) => accounts.find((a) => a.id === id);

  return (
    <>
      {[...groups].map(([accountId, payouts]) => {
        const a = acct(accountId);
        return (
          <FinanceCard key={accountId ?? "none"} className="overflow-x-auto" aria-label={a ? `${a.holderName}付` : "還沒指定誰付"}>
            <div className="flex flex-wrap items-baseline gap-2.5 px-5 pb-2 pt-4">
              <h2 className="text-base font-semibold">{a ? `${a.holderName}付` : "還沒指定誰付"}</h2>
              {a && <span className="text-[13px] text-neutral-500">從 {a.name}（{locName(a.locationId)}）</span>}
              <Amount cents={payouts.reduce((s, p) => s + p.paidAmount, 0)} dollar className="ml-auto text-sm font-semibold" />
            </div>
            <div className="min-w-[620px]">
              <RowHead />
              {payouts.map((p) => (
                <PayoutRow key={p.id} p={p} account={a} locName={locName} canSettle={canSettle} />
              ))}
            </div>
          </FinanceCard>
        );
      })}
      {transfers.length > 0 && (
        <FinanceCard className="overflow-x-auto" aria-label="分部往來轉平">
          <div className="flex items-center gap-1.5 px-5 pb-2 pt-4">
            <h2 className="text-base font-semibold">分部往來轉平</h2>
            <InfoTip label="說明">一個分部的錢替另一個分部付了帳（例如高雄的錢付了台南的老師），付完款後兩個分部之間會互欠。轉這一筆就兩清。</InfoTip>
          </div>
          <div className="min-w-[620px]">
            {transfers.map((t) => (
              <TransferRow key={t.id} t={t} from={acct(t.fromMoneyAccountId)} to={acct(t.toMoneyAccountId)} locName={locName} canSettle={canSettle} />
            ))}
          </div>
        </FinanceCard>
      )}
    </>
  );
}

const grid = "grid grid-cols-[minmax(160px,1.6fr)_minmax(100px,1fr)_minmax(80px,.8fr)_minmax(150px,1fr)] items-center gap-4 border-t border-neutral-100 px-5 py-3.5 text-sm";

const RowHead = () => (
  <div className={cn(grid, "py-2 text-xs text-neutral-500")}>
    <span>付給</span>
    <span className="text-right">應付</span>
    <span className="text-right">實付</span>
    <span />
  </div>
);

function PayoutRow({ p, account, locName, canSettle }: { p: PayoutView & { name: string }; account?: MoneyAccountView; locName: (id: number) => string; canSettle: boolean }) {
  const { meId } = useFinanceRole();
  const [markPaid, paid] = useMarkPayoutPaidMutation();
  const [remove, removing] = useDeletePayoutMutation();
  const [confirmVoid, setConfirmVoid] = useState(false);
  const canPay = canSettle || (account && account.holderUserId === meId);
  const cross = account && account.locationId !== p.locationId;

  const pay = async () => {
    try {
      await markPaid({ id: p.id }).unwrap();
      toast.success(`已付給 ${p.name}`);
    } catch (e) {
      toast.error(financeErrorText(e));
    }
  };
  const del = async () => {
    try {
      await remove(p.id).unwrap();
      setConfirmVoid(false);
    } catch (e) {
      toast.error(financeErrorText(e));
    }
  };

  return (
    <div className={grid}>
      <span className="flex flex-col gap-0.5">
        {p.partyType === "TEACHER" ? (
          <Link href={`/finance/payouts/teachers/${p.partyId}`} className="font-medium text-primary-800 hover:underline">
            {p.name}
          </Link>
        ) : (
          <span className="font-medium">{p.name}</span>
        )}
        <span className="text-xs text-neutral-500">
          {KIND[p.payableKey] ?? p.payableKey} · {locName(p.locationId)}
          {cross && <span className="text-warning-900"> · 跨分部</span>}
        </span>
      </span>
      <Amount cents={p.amount} decimals className="text-right text-neutral-500" />
      <Amount cents={p.paidAmount} className="text-right font-semibold" />
      <span className="flex items-center justify-end gap-1">
        {p.status === "PAID" ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-900">
              <Check className="size-4" />已付款 {p.paidDate && md(p.paidDate)}
            </span>
            {canSettle && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmVoid(true)}>作廢</Button>
            )}
          </>
        ) : (
          <>
            {canSettle && (
              <Button variant="ghost" size="sm" isLoading={removing.isLoading} onClick={del}>移除</Button>
            )}
            {canPay && (
              <Button variant="secondary" size="sm" isLoading={paid.isLoading} disabled={!account} onClick={pay}>
                標記已付款
              </Button>
            )}
          </>
        )}
      </span>
      <ConfirmDialog
        open={confirmVoid}
        title="作廢這筆付款？"
        message={`${p.name} ${amountText(p.paidAmount, { dollar: true })} 會變回待付，帳本記一筆更正。`}
        confirmLabel="作廢"
        variant="danger"
        isLoading={removing.isLoading}
        onConfirm={del}
        onCancel={() => setConfirmVoid(false)}
      />
    </div>
  );
}

function TransferRow({ t, from, to, locName, canSettle }: { t: TransferView; from?: MoneyAccountView; to?: MoneyAccountView; locName: (id: number) => string; canSettle: boolean }) {
  const { meId } = useFinanceRole();
  const [done, doing] = useMarkTransferDoneMutation();
  const [remove, removing] = useDeleteMoneyTransferMutation();
  const canDo = canSettle || from?.holderUserId === meId;
  return (
    <div className={grid}>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{from && to ? `${locName(from.locationId)} → ${locName(to.locationId)}` : "轉帳"}</span>
        <span className="text-xs text-neutral-500">{from?.name} → {to?.name}</span>
      </span>
      <Amount cents={t.settleAmount ?? t.amount} decimals className="text-right text-neutral-500" />
      <Amount cents={t.amount} className="text-right font-semibold" />
      <span className="flex items-center justify-end gap-1">
        {t.status === "PAID" ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-900">
            <Check className="size-4" />已轉 {t.date && md(t.date)}
          </span>
        ) : (
          <>
            {canSettle && (
              <Button variant="ghost" size="sm" isLoading={removing.isLoading} onClick={() => remove(t.id).unwrap().catch((e) => toast.error(financeErrorText(e)))}>
                移除
              </Button>
            )}
            {canDo && (
              <Button
                variant="secondary"
                size="sm"
                isLoading={doing.isLoading}
                onClick={() => done({ id: t.id }).unwrap().then(() => toast.success("已轉")).catch((e) => toast.error(financeErrorText(e)))}
              >
                標記已轉
              </Button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

function CreateRunDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [asOf, setAsOf] = useState(lastMonthEnd());
  const [create, { isLoading }] = useCreatePayoutRunMutation();
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    try {
      const run = await create({ asOf }).unwrap();
      const n = run.payouts.length + run.transfers.length;
      toast.success(n > 0 ? `列出 ${run.payouts.length} 筆付款` : "沒有要付的錢");
      onClose();
    } catch (e) {
      setError(financeErrorText(e));
    }
  };
  return (
    <Drawer open={open} onClose={onClose} title="建立付款批次" submitText="列出要付的錢" onSubmit={submit} isLoading={isLoading} disabled={!asOf}>
      <div className="flex flex-col gap-3 pb-4">
        <Field label="算到哪一天" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <p className="text-[13px] text-neutral-500">列出到這天為止每位老師、場地可以發的錢，以及誰從哪個帳戶付。</p>
        {error && <p className="text-sm text-danger-700">{error}</p>}
      </div>
    </Drawer>
  );
}
