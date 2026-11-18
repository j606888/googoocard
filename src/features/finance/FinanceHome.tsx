"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightLeft, ChevronDown, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import Field, { FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import {
  useCreateTransferMutation,
  useGetFinanceBalanceQuery,
  useGetFinanceSettingsQuery,
  useVoidTransferMutation,
  type BalanceEntry,
  type FinanceSettings,
} from "@/store/slices/finance";
import { netPairs } from "@/domains/finance/flows";
import { REASON_TEXT, dateLabel, financeErrorText, periodLabel, todayKey } from "./financeUi";
import { formatCardSerial } from "@/lib/cardSerial";

type Pair = { from: number; to: number; amount: number };

/** 財務首頁：分部之間誰欠誰、從哪來（docs/finance-lite.md §8）。 */
export default function FinanceHome() {
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data: balance, isLoading } = useGetFinanceBalanceQuery();
  const [transfer, setTransfer] = useState<Pair | null>(null);
  const [month, setMonth] = useState(() => toTaipeiMonthKey(new Date()));

  if (isLoading || !balance || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl opacity-60" />
      </div>
    );
  }

  const say = sayer(settings);
  const monthEntries = balance.entries.filter((e) => toTaipeiMonthKey(new Date(e.date)) === month);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="hidden text-2xl font-bold text-neutral-900 lg:block">財務</h1>
        {(settings.isAdmin || settings.canManage) && (
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <Link href="/finance/settings">
              <Settings />
              財務設定
            </Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        {balance.pairs.length === 0 ? (
          <p className="text-lg font-bold text-neutral-900">目前互不相欠</p>
        ) : (
          balance.pairs.map((pair) => (
            <div key={`${pair.from}-${pair.to}`} className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-lg font-bold text-neutral-900">
                {say.headline(pair)}
                <span className="ml-2 tabular-nums">${formatMoney(Math.round(pair.amount))}</span>
              </p>
              {settings.canManage && (
                <Button variant="secondary" size="sm" onClick={() => setTransfer(pair)}>
                  <ArrowRightLeft />
                  記一筆轉帳
                </Button>
              )}
            </div>
          ))
        )}
        {balance.unsettled.length > 0 && <Unsettled items={balance.unsettled} say={say} />}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-bold text-neutral-900">明細</h2>
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>
        {monthEntries.length === 0 ? (
          <EmptyState kind="inline" title="這個月沒有往來" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {monthEntries.map((e) => (
              <EntryRow key={entryKey(e)} entry={e} say={say} canManage={settings.canManage} />
            ))}
          </ul>
        )}
      </section>

      {settings.canManage && (
        <div>
          <Button variant="link" size="sm" onClick={() => setTransfer({ from: 0, to: 0, amount: 0 })}>
            記一筆其他轉帳
          </Button>
        </div>
      )}

      {transfer && <TransferDrawer initial={transfer} settings={settings} onClose={() => setTransfer(null)} />}
    </div>
  );
}

const entryKey = (e: BalanceEntry) =>
  e.kind === "period" ? `p${e.periodId}` : e.kind === "breakage" ? `b${e.studentCardId}` : `t${e.transferId}`;

/** 用「我」的角度講分部之間的往來：我是台南負責人 →「你欠 Sean」「Sean 欠你」。 */
function sayer(settings: FinanceSettings) {
  const loc = (id: number) => settings.locations.find((l) => l.id === id);
  const keeperName = (id: number) => {
    const k = loc(id)?.keeperUserId;
    return k ? settings.members.find((m) => m.userId === k)?.name ?? null : null;
  };
  const mine = (id: number) => loc(id)?.keeperUserId === settings.me;
  const party = (id: number) => {
    if (mine(id)) return "你";
    const name = loc(id)?.name ?? "（未知分部）";
    const keeper = keeperName(id);
    return keeper ? `${keeper}（${name}）` : name;
  };
  return {
    location: (id: number) => loc(id)?.name ?? "（未知分部）",
    headline: (p: Pair) => `${party(p.from)}欠${party(p.to)}`,
    /** 從我的角度，這筆讓我多欠（−）還是多被欠（＋）；不關我的事回 null。 */
    signFor: (p: Pair) => (mine(p.from) ? -1 : mine(p.to) ? 1 : null),
    party,
  };
}

type Say = ReturnType<typeof sayer>;

function Unsettled({ items, say }: { items: { periodId: number; startTime: string; lessonId: number; lessonName: string; locationId: number | null }[]; say: Say }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-neutral-100 pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 text-left text-sm text-warning-800"
      >
        <span className="flex-1">還有 {items.length} 堂點了名、還沒結清，錢還沒算進來</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((u) => (
            <li key={u.periodId}>
              <Link
                href={`/lessons/${u.lessonId}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
              >
                <span className="flex-1 truncate">{u.lessonName}</span>
                {u.locationId && <span className="text-neutral-500">{say.location(u.locationId)}</span>}
                <span className="tabular-nums text-neutral-500">{periodLabel(u.startTime)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryRow({ entry: e, say, canManage }: { entry: BalanceEntry; say: Say; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [voidTransfer, { isLoading }] = useVoidTransferMutation();
  const pairs = useMemo(() => netPairs(e.flows), [e.flows]);

  const title =
    e.kind === "period" ? (
      <Link href={`/lessons/${e.lessonId}`} className="hover:underline">
        {e.lessonName}
      </Link>
    ) : e.kind === "breakage" ? (
      `卡到期 ${formatCardSerial(e.serialNumber)} ${e.studentName}（剩 ${e.remainingSessions} 格）`
    ) : (
      `轉帳${e.note ? `：${e.note}` : ""}`
    );
  const when = e.kind === "period" ? periodLabel(e.date) : dateLabel(e.date);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-medium text-neutral-900">{title}</span>
          <span className="text-[13px] text-neutral-500">{when}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {pairs.map((p) => {
            const sign = say.signFor(p);
            return (
              <span
                key={`${p.from}-${p.to}`}
                className={cn(
                  "text-sm tabular-nums",
                  sign === 1 ? "text-primary-700" : sign === -1 ? "text-danger-700" : "text-neutral-800"
                )}
              >
                {say.headline(p)} ${formatMoney(Math.round(p.amount))}
              </span>
            );
          })}
        </div>
        {e.flows.length > 1 && (
          <button
            type="button"
            aria-label="看細項"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-0.5 pl-1 text-[13px] text-neutral-600">
          {e.flows.map((f, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {REASON_TEXT[f.reason]}：{say.location(f.from)} 欠 {say.location(f.to)}
              </span>
              <span className="tabular-nums">${formatMoney(Math.round(f.amount))}</span>
            </li>
          ))}
        </ul>
      )}
      {e.kind === "transfer" && canManage && (
        <div>
          <Button
            variant="link"
            size="sm"
            isLoading={isLoading}
            onClick={async () => {
              try {
                await voidTransfer(e.transferId).unwrap();
                toast.success("已作廢這筆轉帳");
              } catch (err) {
                toast.error(financeErrorText(err));
              }
            }}
          >
            記錯了，作廢
          </Button>
        </div>
      )}
    </li>
  );
}

function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const shift = (d: number) => {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1 + d, 1));
    onChange(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const [y, m] = month.split("-").map(Number);
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="iconSm" aria-label="上個月" onClick={() => shift(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-20 text-center text-sm font-medium tabular-nums text-neutral-800">
        {y} 年 {m} 月
      </span>
      <Button variant="ghost" size="iconSm" aria-label="下個月" onClick={() => shift(1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** 記一筆轉帳：從誰（欠錢的分部）給誰；預設帶入目前的欠款。 */
function TransferDrawer({ initial, settings, onClose }: { initial: Pair; settings: FinanceSettings; onClose: () => void }) {
  const active = settings.locations.filter((l) => !l.archivedAt);
  const [from, setFrom] = useState(initial.from || active[0]?.id || 0);
  const [to, setTo] = useState(initial.to || active.find((l) => l.id !== (initial.from || active[0]?.id))?.id || 0);
  const [amount, setAmount] = useState(initial.amount ? String(Math.round(initial.amount)) : "");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [create, { isLoading }] = useCreateTransferMutation();
  const options = active.map((l) => ({ value: l.id, label: l.name }));
  const valid = from && to && from !== to && Number(amount) > 0;

  return (
    <Drawer
      open
      title="記一筆轉帳"
      subtitle="付了錢之後記下來，往來就會減少"
      onClose={onClose}
      isLoading={isLoading}
      disabled={!valid}
      submitText="記下來"
      onSubmit={async () => {
        try {
          await create({ fromLocationId: from, toLocationId: to, amount: Number(amount), date, note: note.trim() || null }).unwrap();
          toast.success("已記下轉帳");
          onClose();
        } catch (e) {
          toast.error(financeErrorText(e));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>付錢的分部</FieldLabel>
          <Select aria-label="付錢的分部" value={from} options={options} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>收錢的分部</FieldLabel>
          <Select aria-label="收錢的分部" value={to} options={options} onChange={setTo} />
        </div>
        <Field
          label="金額"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
        />
        <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="備註" hint="（選填）" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Drawer>
  );
}
