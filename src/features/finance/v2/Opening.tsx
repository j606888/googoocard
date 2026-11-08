"use client";

// 開帳精靈（docs/finance-v2/04 §3；設計稿「開帳精靈」）：轉換日 → 資金帳戶 → 預收與應收 → 次數包與待付 → 確認期初。
import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import Field, { FieldLabel } from "@/components/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetFinanceSettingsQuery, useGetFinanceTeachersQuery, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import { useGetMoneyAccountsQuery, useGetOpeningQuery, useOpenLedgerMutation, usePreviewOpeningMutation, type OpeningPreviewView } from "@/store/slices/ledger";
import type { OpeningParams } from "@/service/ledger/opening";
import { financeErrorText, todayKey } from "../financeUi";
import { AddAccountDrawer } from "./Accounts";
import { Amount, FinanceCard, FinanceShell, useIsOwner } from "./ui";

const STEPS = ["轉換日", "資金帳戶", "預收與應收", "次數包與待付", "確認期初"];
type Payable = OpeningParams["payables"][number];

/** /finance/opening：開帳後要換一天重開時用；第一次開帳走 /finance/setup 精靈的第 7 步。 */
export default function Opening() {
  const { data: state } = useGetOpeningQuery();
  return (
    <FinanceShell
      title={state?.opened ? "重新開帳" : "開帳"}
      guide="opening"
      crumb={{ href: "/finance/settings", label: "財務設定" }}
    >
      <OpeningFlow />
    </FinanceShell>
  );
}

/**
 * 開帳的五個小步驟。`onBack`：在第一個小步驟按「上一步」時呼叫（精靈裡回到第 6 步）。
 * `blocker`：不是 null 就不能按開帳，顯示在按鈕上方（精靈裡：前面還有步驟沒做完）。
 */
export function OpeningFlow({ onBack, blocker }: { onBack?: () => void; blocker?: ReactNode }) {
  const router = useRouter();
  const isOwner = useIsOwner();
  const { data: state, isLoading } = useGetOpeningQuery();
  const { data: maData } = useGetMoneyAccountsQuery();
  const { data: locData } = useGetLocationsQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const [preview, pv] = usePreviewOpeningMutation();
  const [open, opening] = useOpenLedgerMutation();

  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<"CONVENTION" | "ACTUAL">("CONVENTION");
  const [cash, setCash] = useState<Record<number, string>>({});
  const [payables, setPayables] = useState<Payable[]>([]);
  const [result, setResult] = useState<OpeningPreviewView | null>(null);
  const [addFor, setAddFor] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  // 已開過帳 → 帶入上次的參數
  useEffect(() => {
    if (!state) return;
    const p = state.params;
    setDate(p?.conversionDate ?? state.suggestedDate ?? todayKey());
    if (p) {
      setMethod(p.method);
      setCash(Object.fromEntries(p.cash.map((c) => [c.moneyAccountId, String(c.amount)])));
      setPayables(p.payables);
    }
  }, [state]);

  const accounts = (maData?.accounts ?? []).filter((a) => !a.archivedAt);
  const locations = (locData?.locations ?? []).filter((l) => !l.archivedAt);
  const locName = (id: number) => locations.find((l) => l.id === id)?.name ?? "";
  const userName = (id: number) => settings?.members.find((m) => m.userId === id)?.name ?? `#${id}`;

  const params: OpeningParams = {
    conversionDate: date,
    method,
    cash: method === "ACTUAL" ? accounts.map((a) => ({ moneyAccountId: a.id, amount: Number(cash[a.id] || 0) })) : [],
    payables: payables.filter((p) => p.amount !== 0),
  };

  const refresh = async () => {
    if (!date) return;
    try {
      setResult(await preview(params).unwrap());
    } catch (e) {
      toast.error(financeErrorText(e, "試算失敗"));
    }
  };
  // 換步驟就重新試算
  useEffect(() => {
    if (step > 0) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (isLoading || !state) return <Skeleton className="h-96 rounded-2xl" />;

  const locked = !!state.lockDate;
  const missing = (result?.errors ?? []).filter((e) => e.code === "NO_MONEY_ACCOUNT" && e.userId !== undefined);

  const submit = async () => {
    try {
      await open(params).unwrap();
      toast.success(`已開帳：${date.replaceAll("-", "/")}`);
      router.push("/finance");
    } catch (e) {
      toast.error(financeErrorText(e, "開帳失敗"));
      setConfirm(false);
    }
  };

  return (
    <>
      {locked ? (
        <FinanceCard className="px-5 py-5 text-sm text-neutral-600">
          已經鎖帳（{state.lockDate?.replaceAll("-", "/")}），不能再重開。期初錯了請用手動分錄更正。
        </FinanceCard>
      ) : (
        <div className="flex max-w-4xl flex-col gap-5">
          <ol className="flex flex-wrap gap-x-5 gap-y-2">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={cn("flex cursor-pointer items-center gap-2 text-sm", i === step ? "font-semibold text-neutral-900" : "text-neutral-500")}
                >
                  <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", i === step ? "bg-primary-900 text-white" : i < step ? "bg-primary-100 text-primary-900" : "bg-neutral-100 text-neutral-600")}>
                    {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {s}
                </button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <FinanceCard className="flex flex-col gap-5 px-5 py-5">
              <Field label="轉換日" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-60" />
              <p className="-mt-3 text-[13px] text-neutral-500">這天（含）以後的事記進帳本，之前的結果算成期初。任何一天都可以。</p>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>現金怎麼算</FieldLabel>
                <SegmentedTabs
                  ariaLabel="現金怎麼算"
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: "CONVENTION", label: "約定：錢在收錢的人那裡" },
                    { value: "ACTUAL", label: "實數：數得出來" },
                  ]}
                />
                <p className="text-[13px] text-neutral-500">
                  {method === "CONVENTION"
                    ? "每個人的期初現金＝他收的舊卡還沒上完的價值。不用數錢，期初公積金是 0。"
                    : "每個資金帳戶填實際有多少，期初公積金是相減出來的，可能是負的。"}
                </p>
              </div>
            </FinanceCard>
          )}

          {step === 1 && (
            <FinanceCard className="flex flex-col gap-4 px-5 py-5">
              {missing.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl bg-warning-50 px-4 py-3">
                  <span className="text-sm font-semibold text-warning-950">這些人收過錢，但還沒有資金帳戶</span>
                  {missing.map((e) => (
                    <div key={e.userId} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex-1">{userName(e.userId!)} · {e.cardIds?.length ?? 0} 張卡</span>
                      <Button size="sm" variant="secondary" onClick={() => setAddFor(e.userId!)}>建帳戶</Button>
                    </div>
                  ))}
                  <span className="text-[13px] text-warning-950">要先在財務設定把他勾成保管人。</span>
                </div>
              )}
              {accounts.length === 0 && <p className="text-sm text-neutral-500">還沒有資金帳戶</p>}
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-medium">{a.name}</span>
                    <span className="text-xs text-neutral-500">{locName(a.locationId)}</span>
                  </span>
                  {method === "ACTUAL" ? (
                    <input
                      aria-label={`${a.name} 期初金額`}
                      inputMode="decimal"
                      value={cash[a.id] ?? ""}
                      onChange={(e) => setCash((c) => ({ ...c, [a.id]: e.target.value }))}
                      className="h-11 w-36 rounded-xl border border-neutral-300 px-3 text-right tabular-nums"
                      placeholder="0"
                    />
                  ) : (
                    <Amount cents={result?.rows.filter((r) => r.label === a.name).reduce((s, r) => s + r.amount, 0) ?? 0} dollar className="text-[15px] font-semibold" />
                  )}
                </div>
              ))}
              <Button variant="link" size="sm" className="self-start" onClick={() => refresh()}>重新試算</Button>
            </FinanceCard>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="舊卡" value={`${result?.legacyCards.count ?? 0} 張`} />
              <Stat label="預收（還欠學生的課）" cents={result?.legacyCards.deferred ?? 0} />
              <Stat label="應收（還沒付的卡）" cents={result?.legacyCards.receivable ?? 0} />
            </div>
          )}

          {step === 3 && <PayablesStep payables={payables} setPayables={setPayables} locations={locations} />}

          {step === 4 && result && <OpeningSheet result={result} locName={locName} />}

          {(result?.errors ?? []).length > 0 && step > 0 && (
            <p className="text-sm text-danger-700">還有 {result!.errors.length} 個問題要先處理（見「資金帳戶」）</p>
          )}

          {step === STEPS.length - 1 && blocker}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-neutral-500">第一次鎖帳前都可以換一天重開</span>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>上一步</Button>
              ) : (
                onBack && <Button variant="secondary" onClick={onBack}>上一步</Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!date}>下一步</Button>
              ) : (
                <Button disabled={!isOwner || !!blocker || !result || result.errors.length > 0 || pv.isLoading} onClick={() => setConfirm(true)}>
                  {state.opened ? "重新開帳" : "開帳"}
                </Button>
              )}
            </div>
          </div>
          {step === STEPS.length - 1 && !isOwner && <p className="text-right text-[13px] text-neutral-500">只有教室擁有者能開帳</p>}
        </div>
      )}
      <AddAccountDrawer open={addFor !== null} onClose={() => { setAddFor(null); refresh(); }} holderUserId={addFor ?? undefined} />
      <ConfirmDialog
        open={confirm}
        title={state.opened ? "重新開帳？" : `從 ${date.replaceAll("-", "/")} 開帳？`}
        message={state.opened ? "帳本會從新的轉換日全部重算（手動分錄保留）。" : "這天以後的事會開始記進帳本。鎖帳前都可以重開。"}
        confirmLabel={state.opened ? "重新開帳" : "開帳"}
        isLoading={opening.isLoading}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      />
      {state.opened && !locked && step === 0 && (
        <p className="text-[13px] text-neutral-500">
          目前從 {state.conversionDate?.replaceAll("-", "/")} 開帳。<Link className="text-primary-800" href="/finance">回總覽</Link>
        </p>
      )}
    </>
  );
}

function Stat({ label, value, cents }: { label: string; value?: string; cents?: number }) {
  return (
    <FinanceCard className="flex flex-col gap-1 px-4 py-3.5">
      <span className="text-[13px] text-neutral-500">{label}</span>
      {cents !== undefined ? <Amount cents={cents} dollar className="text-xl font-semibold" /> : <span className="text-xl font-semibold">{value}</span>}
    </FinanceCard>
  );
}

function PayablesStep({
  payables,
  setPayables,
  locations,
}: {
  payables: Payable[];
  setPayables: (f: (p: Payable[]) => Payable[]) => void;
  locations: { id: number; name: string }[];
}) {
  const { data: tData } = useGetFinanceTeachersQuery();
  const { data: vData } = useGetFinanceVenuesQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const parties = (kind: Payable["kind"]) =>
    kind === "TEACHER"
      ? (tData?.teachers ?? []).map((t) => ({ value: t.id, label: t.name }))
      : kind === "VENUE"
        ? (vData?.venues ?? []).filter((v) => !v.archivedAt).map((v) => ({ value: v.id, label: v.name }))
        : (settings?.members ?? []).map((m) => ({ value: m.userId, label: m.name }));
  const set = (i: number, patch: Partial<Payable>) => setPayables((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <FinanceCard className="flex flex-col gap-3 px-5 py-5">
      <p className="text-sm text-neutral-600">轉換日前次數包剩下的，系統會自己記成預付場地費。還沒付的老師錢、場租、代墊建議先私下結清，這裡就不用填。</p>
      {payables.map((p, i) => (
        <div key={i} className="grid grid-cols-2 items-center gap-2 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[110px_minmax(0,1fr)_120px_110px_44px] sm:border-t-0 sm:pt-0">
          <Select size="sm" value={p.kind} onChange={(v) => set(i, { kind: v, partyId: 0 })} options={[{ value: "TEACHER", label: "老師" }, { value: "VENUE", label: "場地" }, { value: "OWNER", label: "代墊" }]} />
          <Select size="sm" value={p.partyId || undefined} onChange={(v) => set(i, { partyId: v })} options={parties(p.kind)} placeholder="對象" />
          <Select size="sm" value={p.locationId || undefined} onChange={(v) => set(i, { locationId: v })} options={locations.map((l) => ({ value: l.id, label: l.name }))} placeholder="分部" />
          <input aria-label="金額" inputMode="decimal" value={p.amount || ""} onChange={(e) => set(i, { amount: Number(e.target.value) || 0 })} className="h-9 rounded-lg border border-neutral-300 px-2 text-right text-sm tabular-nums" placeholder="0" />
          <Button variant="ghost" size="iconSm" aria-label="刪除" onClick={() => setPayables((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
        </div>
      ))}
      <Button variant="link" size="sm" className="self-start" onClick={() => setPayables((ps) => [...ps, { kind: "TEACHER", partyId: 0, locationId: locations[0]?.id ?? 0, amount: 0 }])}>
        <Plus className="size-4" />加一筆還沒付的
      </Button>
    </FinanceCard>
  );
}

function OpeningSheet({ result, locName }: { result: OpeningPreviewView; locName: (id: number) => string }) {
  const locs = result.totals.map((t) => t.locationId);
  const groups: { g: "ASSET" | "LIABILITY" | "EQUITY"; label: string; total: (t: (typeof result.totals)[number]) => number }[] = [
    { g: "ASSET", label: "資產", total: (t) => t.assets },
    { g: "LIABILITY", label: "負債", total: (t) => t.liabilities },
    { g: "EQUITY", label: "權益", total: (t) => t.equity },
  ];
  const labels = (g: string) => [...new Set(result.rows.filter((r) => r.group === g).map((r) => r.label))];
  const cell = (g: string, label: string, loc: number) => result.rows.filter((r) => r.group === g && r.label === label && r.locationId === loc).reduce((s, r) => s + r.amount, 0);
  const td = "px-4 py-2.5 text-right tabular-nums first:text-left";
  if (locs.length === 0) return <FinanceCard className="px-5 py-5 text-sm text-neutral-500">期初都是 0</FinanceCard>;
  return (
    <FinanceCard className="overflow-x-auto py-2" aria-label="期初資產負債表">
      <h2 className="px-5 pb-1 pt-2 text-base font-semibold">{result.conversionDate.replaceAll("-", "/")} 期初資產負債表</h2>
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">科目</th>
            {locs.map((l) => <th key={l} scope="col" className="px-4 py-2.5 text-right font-medium">{locName(l)}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ g, label, total }) => (
            <Fragment key={g}>
              <tr><td colSpan={locs.length + 1} className="px-4 pb-1 pt-5 text-xs font-semibold text-neutral-600">{label}</td></tr>
              {labels(g).map((l) => (
                <tr key={`${g}-${l}`} className="border-b border-neutral-100">
                  <td className={td}>{l}</td>
                  {locs.map((loc) => <td key={loc} className={td}><Amount cents={cell(g, l, loc)} blankZero /></td>)}
                </tr>
              ))}
              <tr className="border-b border-neutral-100 border-t border-t-neutral-300 bg-neutral-50 font-semibold">
                <td className={td}>{label}合計</td>
                {result.totals.map((t) => <td key={t.locationId} className={td}><Amount cents={total(t)} /></td>)}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </FinanceCard>
  );
}
