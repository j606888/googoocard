"use client";

// 結帳（docs/finance-v2/05 §3.10；設計稿「結帳」）：結帳清單、分部簽核、鎖帳／解鎖、鎖帳紀錄。
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Field from "@/components/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import { addDays } from "@/domains/ledger/lines";
import { cn } from "@/lib/utils";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetCloseChecklistQuery, useGetLockStateQuery, useSetLockDateMutation, useSignOffBranchMutation, type CloseChecklist } from "@/store/slices/ledger";
import { financeErrorText, todayKey } from "../financeUi";
import { useFinanceRole } from "../useCanSettle";
import { Amount, FinanceCard, FinanceShell, useIsOwner } from "./ui";

const lastMonthEnd = () => addDays(`${todayKey().slice(0, 7)}-01`, -1);
const slash = (d: string) => d.replaceAll("-", "/");

export default function Close() {
  const [asOf, setAsOf] = useState(lastMonthEnd());
  const { data, isLoading, isError } = useGetCloseChecklistQuery({ asOf });
  const items = data?.items ?? [];
  const done = items.filter((i) => i.done).length;

  return (
    <FinanceShell
      guide="close"
      title={`結帳到 ${Number(asOf.slice(5, 7))}/${Number(asOf.slice(8))}`}
      actions={
        <>
          {data && <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 tabular-nums">完成 {done} / {items.length}</span>}
          <input type="date" aria-label="結帳到哪一天" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm" />
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data ? (
        <EmptyState kind="inline" title="讀不到結帳清單" />
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <FinanceCard className="min-w-0 flex-[999_1_520px] py-1" aria-label="結帳清單">
            {items.map((item, i) => (
              <ChecklistItem key={item.key} item={item} first={i === 0} asOf={asOf} />
            ))}
          </FinanceCard>
          <LockPanel asOf={asOf} />
        </div>
      )}
    </FinanceShell>
  );
}

type Item = CloseChecklist["items"][number];
const TITLES: Record<string, string> = {
  ATTENDANCE: "過去的時段都點名了",
  RECEIVABLES: "未付款都處理了",
  SPLIT_RULES: "有課的都設了分帳",
  LEDGER_HEALTH: "帳本健康檢查",
  CASH_COUNTS: "資金帳戶盤點",
  SIGNOFFS: "各分部負責人看過損益表",
};

function ChecklistItem({ item, first, asOf }: { item: Item; first: boolean; asOf: string }) {
  const optional = "optional" in item && item.optional;
  return (
    <div className={cn("flex items-start gap-3.5 px-5 py-4", !first && "border-t border-neutral-100")}>
      {item.done ? (
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-900" aria-label="完成">
          <Check className="size-4" strokeWidth={2.6} />
        </span>
      ) : (
        <span
          className={cn("size-[26px] shrink-0 rounded-full border-2", optional ? "border-dashed border-neutral-400" : "border-warning-500")}
          aria-label={optional ? "可略過" : "待處理"}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-[15px]">
          {TITLES[item.key] ?? item.key}
          {optional && <span className="text-[13px] text-neutral-500"> · 可略過</span>}
        </span>
        {!item.done && <Details item={item} asOf={asOf} />}
        {item.key === "SIGNOFFS" && item.done && <Details item={item} asOf={asOf} />}
      </div>
    </div>
  );
}

function Details({ item, asOf }: { item: Item; asOf: string }) {
  const box = (children: ReactNode, key?: string | number) => (
    <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm">{children}</div>
  );
  switch (item.key) {
    case "ATTENDANCE":
      return (
        <div className="flex flex-col gap-1.5">
          {(item.details as { periodId: number; lessonId: number; lessonName: string; startTime: string }[]).slice(0, 8).map((p) =>
            box(
              <>
                <span className="flex-1">{p.lessonName} · {new Date(p.startTime).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", timeZone: "Asia/Taipei" })}</span>
                <Link className="font-semibold text-primary-800" href={`/lessons/${p.lessonId}`}>去點名</Link>
              </>,
              p.periodId,
            ),
          )}
        </div>
      );
    case "RECEIVABLES":
      return <Receivables item={item} />;
    case "SPLIT_RULES":
      return (
        <div className="flex flex-col gap-1.5">
          {(item.details as { lessonId: number; lessonName: string; periods: number }[]).map((l) =>
            box(
              <>
                <span className="flex-1">{l.lessonName} · {l.periods} 堂</span>
                <Link className="font-semibold text-primary-800" href={`/lessons/${l.lessonId}`}>設分帳</Link>
              </>,
              l.lessonId,
            ),
          )}
        </div>
      );
    case "LEDGER_HEALTH":
      return <span className="text-sm text-neutral-600">{item.count} 個問題：有紀錄記不進帳本（常見原因：收錢的人沒有資金帳戶）。</span>;
    case "CASH_COUNTS":
      return <Link href="/finance/accounts" className="text-sm font-semibold text-primary-800">{item.count} 個帳戶還沒盤點</Link>;
    case "SIGNOFFS":
      return <Signoffs item={item} asOf={asOf} />;
    default:
      return null;
  }
}

function Receivables({ item }: { item: Item }) {
  const rows = item.details as { partyType: string; partyId: number; name: string; amount: number }[];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.slice(0, 8).map((r) => (
        <div key={`${r.partyType}:${r.partyId}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm">
          <span className="flex-1">{r.name}</span>
          <Amount cents={r.amount} dollar />
        </div>
      ))}
      <Link href="/finance/reports/receivables" className="text-sm font-semibold text-primary-800">看應收帳齡，收款或繼續等</Link>
    </div>
  );
}

function Signoffs({ item, asOf }: { item: Item; asOf: string }) {
  const { data: me } = useGetMeQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const [sign, { isLoading }] = useSignOffBranchMutation();
  const name = (id: number | null) => settings?.members.find((m) => m.userId === id)?.name ?? "";
  const rows = item.details as { locationId: number; name: string; keeperUserId: number | null; signed: boolean }[];
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <span key={r.locationId} className="flex flex-wrap items-center gap-2">
          {r.signed ? <Check className="size-4 text-primary-900" strokeWidth={2.6} /> : <span className="w-4" />}
          {r.name}
          {r.keeperUserId && <span className="text-neutral-500">· {name(r.keeperUserId)}</span>}
          {!r.signed && <span className="text-warning-900">還沒看</span>}
          {!r.signed && r.keeperUserId === me?.id && (
            <>
              <Link href="/finance/reports/pnl" className="ml-1 font-semibold text-primary-800">看損益表</Link>
              <Button
                variant="secondary"
                size="sm"
                isLoading={isLoading}
                onClick={() => sign({ locationId: r.locationId, asOf }).unwrap().catch((e) => toast.error(financeErrorText(e)))}
              >
                看過了
              </Button>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function LockPanel({ asOf }: { asOf: string }) {
  const { canSettle } = useFinanceRole();
  const isOwner = useIsOwner();
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data } = useGetLockStateQuery();
  const [setLock, { isLoading }] = useSetLockDateMutation();
  const [date, setDate] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"lock" | "unlock" | null>(null);
  const target = date ?? asOf;
  const name = (id: number) => settings?.members.find((m) => m.userId === id)?.name ?? "";
  const backward = data?.lockDate && target < data.lockDate;

  const run = async (lockDate: string | null) => {
    try {
      await setLock({ lockDate }).unwrap();
      toast.success(lockDate ? `已鎖到 ${slash(lockDate)}` : "已解鎖");
      setConfirm(null);
    } catch (e) {
      toast.error(financeErrorText(e));
      setConfirm(null);
    }
  };

  return (
    <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4" aria-label="鎖帳">
      <FinanceCard className="flex flex-col gap-3.5 px-5 py-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold">鎖帳</h2>
          <InfoTip label="說明">鎖住的日子不能再新增或改帳。之後補點名、補收款，差額會記在鎖帳日的隔天。往後推鎖帳日可以結算的人都能做；往前或解鎖只有教室擁有者能做。</InfoTip>
        </div>
        <div className="flex justify-between text-sm"><span className="text-neutral-500">目前鎖到</span><span>{data?.lockDate ? slash(data.lockDate) : "還沒鎖過"}</span></div>
        <div className="flex justify-between text-sm"><span className="text-neutral-500">開帳日</span><span className="tabular-nums">{data ? slash(data.conversionDate) : ""}</span></div>
        {data && !data.opened ? (
          <Link href="/finance/opening" className="text-sm font-semibold text-primary-800">要先開帳才能鎖帳</Link>
        ) : (
          canSettle && (
            <>
              <Field label="鎖到哪一天" type="date" value={target} onChange={(e) => setDate(e.target.value)} />
              <Button disabled={!target || (backward && !isOwner) || target === data?.lockDate} onClick={() => setConfirm("lock")}>
                {backward ? "把鎖帳日往前" : "鎖帳"}
              </Button>
              <span className="text-[13px] text-neutral-500">清單沒做完也可以鎖</span>
              {isOwner && data?.lockDate && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setConfirm("unlock")}>解鎖</Button>
              )}
            </>
          )
        )}
      </FinanceCard>
      <FinanceCard className="flex flex-col gap-2 px-5 py-4">
        <h2 className="text-base font-semibold">鎖帳紀錄</h2>
        {(data?.history ?? []).length === 0 && <span className="text-sm text-neutral-500">還沒有紀錄</span>}
        {(data?.history ?? []).map((h) => (
          <div key={h.id} className="flex justify-between gap-2 border-t border-neutral-100 pt-2 text-sm first-of-type:border-t-0">
            <span>{h.toDate ? `鎖到 ${slash(h.toDate)}` : "解鎖"}{h.fromDate && <span className="text-neutral-500">（原本 {slash(h.fromDate)}）</span>}</span>
            <span className="text-neutral-500">{name(h.userId)} · {new Date(h.createdAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}</span>
          </div>
        ))}
      </FinanceCard>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "unlock" ? "解鎖帳本？" : `鎖到 ${slash(target)}？`}
        message={confirm === "unlock" ? "解鎖後之前鎖住的日子又可以改帳，會留下紀錄。" : "這天以前的帳就不能再改了，之後的更正會記在隔天。第一次鎖帳後也不能再重開帳。"}
        confirmLabel={confirm === "unlock" ? "解鎖" : "鎖帳"}
        variant={confirm === "unlock" ? "danger" : "primary"}
        isLoading={isLoading}
        onConfirm={() => run(confirm === "unlock" ? null : target)}
        onCancel={() => setConfirm(null)}
      />
    </aside>
  );
}
