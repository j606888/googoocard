"use client";

// 記一筆（docs/finance-v2/05 §3.7）：支出（教室的錢／自己先墊）、轉帳、老闆放錢／拿錢／分紅、手動分錄。
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import Field, { FieldLabel } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useCreateExpenseMutation } from "@/store/slices/finance";
import {
  useCreateJournalEntryMutation,
  useCreateMoneyTransferMutation,
  useCreateOwnerTxnMutation,
  useGetLedgerAccountsQuery,
  useGetMoneyAccountsQuery,
} from "@/store/slices/ledger";
import { DEFAULT_EXPENSE_SUBACCOUNTS } from "@/domains/ledger/accounts";
import { financeErrorText, todayKey } from "../financeUi";
import { useFinanceMembers } from "../useFinanceForm";
import { useFinanceRole } from "../useCanSettle";
import { Amount, amountText, parseYuan } from "./ui";

type Tab = "expense" | "transfer" | "owner" | "journal";
type JLine = { accountId: number | null; locationId: number | null; debit: string; credit: string };
const blankLine = (): JLine => ({ accountId: null, locationId: null, debit: "", credit: "" });

export default function RecordDrawer({ open, onClose, initialTab = "expense" }: { open: boolean; onClose: () => void; initialTab?: Tab }) {
  const { canSettle, meId } = useFinanceRole();
  const { allMembers } = useFinanceMembers();
  const { data: locData } = useGetLocationsQuery(undefined, { skip: !open });
  const { data: maData } = useGetMoneyAccountsQuery(undefined, { skip: !open });
  const { data: acData } = useGetLedgerAccountsQuery(undefined, { skip: !open });
  const [createExpense, ex] = useCreateExpenseMutation();
  const [createTransfer, tr] = useCreateMoneyTransferMutation();
  const [createOwner, ow] = useCreateOwnerTxnMutation();
  const [createJournal, jr] = useCreateJournalEntryMutation();

  const locations = (locData?.locations ?? []).filter((l) => !l.archivedAt);
  const accounts = (maData?.accounts ?? []).filter((a) => !a.archivedAt);
  const myAccounts = canSettle ? accounts : accounts.filter((a) => a.holderUserId === meId);
  const ledgerAccounts = useMemo(() => acData?.accounts ?? [], [acData]);
  const generalId = ledgerAccounts.find((a) => a.systemKey === "EXPENSE_GENERAL")?.id;
  const categories = useMemo(() => {
    const subs = ledgerAccounts.filter((a) => a.parentId === generalId && !a.archivedAt).map((a) => a.name);
    return subs.length > 0 ? subs : [...DEFAULT_EXPENSE_SUBACCOUNTS];
  }, [ledgerAccounts, generalId]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  // 支出
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [advance, setAdvance] = useState(false);
  const [fromAccount, setFromAccount] = useState<number | null>(null);
  const [advanceUser, setAdvanceUser] = useState<number | null>(null);
  // 轉帳
  const [toAccount, setToAccount] = useState<number | null>(null);
  // 業主
  const [ownerKind, setOwnerKind] = useState<"CONTRIBUTION" | "DRAWING" | "DIVIDEND">("CONTRIBUTION");
  const [ownerUser, setOwnerUser] = useState<number | null>(null);
  // 手動分錄
  const [lines, setLines] = useState<JLine[]>([blankLine(), blankLine()]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDate(todayKey());
    setAmount("");
    setNote("");
    setError("");
    setCategory("");
    setLocationId(null);
    setAdvance(false);
    setFromAccount(null);
    setAdvanceUser(null);
    setToAccount(null);
    setOwnerKind("CONTRIBUTION");
    setOwnerUser(null);
    setLines([blankLine(), blankLine()]);
  }, [open, initialTab]);

  const accountLabel = (a: (typeof accounts)[number]) =>
    `${a.name}（${locations.find((l) => l.id === a.locationId)?.name ?? ""}）· ${amountText(a.balance, { dollar: true })}`;
  const accountOptions = (list: typeof accounts) => list.map((a) => ({ value: a.id, label: accountLabel(a) }));
  const defaultFrom = myAccounts.find((a) => a.holderUserId === meId && a.isDefault)?.id ?? myAccounts[0]?.id ?? null;
  const from = fromAccount ?? defaultFrom;
  const loc = locationId ?? accounts.find((a) => a.id === from)?.locationId ?? locations[0]?.id ?? null;
  const memberOptions = allMembers.map((m) => ({ value: m.userId, label: m.name }));
  const cents = parseYuan(amount);

  const journalLines = lines.map((l) => {
    const d = parseYuan(l.debit) ?? 0;
    const c = parseYuan(l.credit) ?? 0;
    return { accountId: l.accountId, locationId: l.locationId, amount: d - c };
  });
  const debitSum = journalLines.reduce((s, l) => s + Math.max(0, l.amount), 0);
  const creditSum = journalLines.reduce((s, l) => s + Math.max(0, -l.amount), 0);
  const filledLines = journalLines.filter((l) => l.amount !== 0);
  const journalValid =
    !!note.trim() && filledLines.length >= 2 && debitSum === creditSum && filledLines.every((l) => l.accountId && l.locationId);

  const valid = (() => {
    if (!date) return false;
    if (tab === "journal") return journalValid;
    if (cents === null || cents <= 0) return false;
    if (tab === "expense") return !!category && !!loc && (advance ? !!(advanceUser ?? meId) : !!from) && cents % 100 === 0;
    if (tab === "transfer") return !!from && !!toAccount && from !== toAccount;
    return !!(ownerUser ?? meId) && (ownerKind === "DIVIDEND" ? !!loc : !!from);
  })();

  const busy = ex.isLoading || tr.isLoading || ow.isLoading || jr.isLoading;

  const submit = async () => {
    setError("");
    try {
      if (tab === "expense") {
        const holder = accounts.find((a) => a.id === from)?.holderUserId;
        await createExpense({
          date,
          amount: cents! / 100,
          locationId: loc!,
          category,
          paidByUserId: advance ? (advanceUser ?? meId!) : holder!,
          ...(advance ? { isAdvance: true } : { moneyAccountId: from! }),
          ...(note.trim() ? { note: note.trim() } : {}),
        }).unwrap();
      } else if (tab === "transfer") {
        await createTransfer({ fromMoneyAccountId: from!, toMoneyAccountId: toAccount!, amount: cents!, date, ...(note.trim() ? { note: note.trim() } : {}) }).unwrap();
      } else if (tab === "owner") {
        await createOwner({
          kind: ownerKind,
          userId: ownerUser ?? meId!,
          amount: cents!,
          date,
          ...(ownerKind === "DIVIDEND" ? { locationId: loc! } : { moneyAccountId: from! }),
          ...(note.trim() ? { note: note.trim() } : {}),
        }).unwrap();
      } else {
        await createJournal({
          date,
          memo: note.trim(),
          lines: filledLines.map((l) => ({ accountId: l.accountId!, locationId: l.locationId!, amount: l.amount })),
        }).unwrap();
      }
      toast.success("記下來了");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "expense", label: "支出" },
    { value: "transfer", label: "轉帳" },
    ...(canSettle
      ? ([
          { value: "owner", label: "老闆放錢／拿錢" },
          { value: "journal", label: "手動分錄" },
        ] as const)
      : []),
  ];
  const journalAccountOptions = ledgerAccounts
    .filter((a) => !a.archivedAt && a.systemKey !== "CASH" && a.systemKey !== "INTERBRANCH")
    .map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <ResponsiveDialog open={open} onClose={onClose} desktop="side">
      <div className="flex items-center justify-between px-5 pt-4">
        <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">記一筆</ResponsiveDialogTitle>
        <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="關閉" className="text-neutral-500">
          <X className="size-5" />
        </Button>
      </div>
      <div className="border-b border-neutral-200 px-3">
        <SegmentedTabs ariaLabel="記什麼" variant="underline" options={tabs} value={tab} onChange={(t) => { setTab(t); setError(""); }} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {tab !== "journal" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Field label="金額" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}

        {tab === "expense" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>類別</FieldLabel>
                <Select value={category || undefined} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} placeholder="選類別" />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>算在哪個分部</FieldLabel>
                <Select value={loc ?? undefined} onChange={setLocationId} options={locationOptions} placeholder="選分部" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>誰付的錢</FieldLabel>
              <SegmentedTabs
                ariaLabel="誰付的錢"
                fill
                value={advance ? "self" : "class"}
                onChange={(v) => setAdvance(v === "self")}
                options={[
                  { value: "class", label: "教室的錢" },
                  { value: "self", label: "自己先墊" },
                ]}
              />
            </div>
            {advance ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel hint="下次付款批次會列出來還他">誰墊的</FieldLabel>
                {canSettle ? (
                  <Select value={advanceUser ?? meId ?? undefined} onChange={setAdvanceUser} options={memberOptions} />
                ) : (
                  <p className="text-[15px]">自己</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>從哪個資金帳戶</FieldLabel>
                <Select value={from ?? undefined} onChange={setFromAccount} options={accountOptions(myAccounts)} placeholder="選帳戶" />
              </div>
            )}
            <Field label="備註" placeholder="例：IG 廣告 12 月" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {tab === "transfer" && (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>從</FieldLabel>
              <Select value={from ?? undefined} onChange={setFromAccount} options={accountOptions(myAccounts)} placeholder="選帳戶" />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>到</FieldLabel>
              <Select value={toAccount ?? undefined} onChange={setToAccount} options={accountOptions(accounts.filter((a) => a.id !== from))} placeholder="選帳戶" />
            </div>
            {from && toAccount && accounts.find((a) => a.id === from)?.locationId !== accounts.find((a) => a.id === toAccount)?.locationId && (
              <p className="text-[13px] text-neutral-500">跨分部，會自動記分部往來</p>
            )}
            <Field label="備註" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {tab === "owner" && (
          <>
            <SegmentedTabs
              ariaLabel="類型"
              fill
              value={ownerKind}
              onChange={setOwnerKind}
              options={[
                { value: "CONTRIBUTION", label: "放錢進來" },
                { value: "DRAWING", label: "拿錢出去" },
                { value: "DIVIDEND", label: "分紅" },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <FieldLabel>誰</FieldLabel>
              <Select value={ownerUser ?? meId ?? undefined} onChange={setOwnerUser} options={memberOptions} />
            </div>
            {ownerKind === "DIVIDEND" ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel hint="從這個分部的公積金分出去，之後在付款批次發">哪個分部的公積金</FieldLabel>
                <Select value={loc ?? undefined} onChange={setLocationId} options={locationOptions} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{ownerKind === "CONTRIBUTION" ? "進哪個資金帳戶" : "從哪個資金帳戶"}</FieldLabel>
                <Select value={from ?? undefined} onChange={setFromAccount} options={accountOptions(accounts)} placeholder="選帳戶" />
              </div>
            )}
            <Field label="備註" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {tab === "journal" && (
          <>
            <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-3">
              <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Field label="摘要" placeholder="例：記帳士調整" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_80px_80px] gap-2 text-xs text-neutral-500">
                <span>科目</span>
                <span>分部</span>
                <span className="text-right">借</span>
                <span className="text-right">貸</span>
              </div>
              {lines.map((l, i) => {
                const set = (patch: Partial<JLine>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_80px_80px] items-center gap-2">
                    <Select size="sm" value={l.accountId ?? undefined} onChange={(v) => set({ accountId: v })} options={journalAccountOptions} placeholder="科目" />
                    <Select size="sm" value={l.locationId ?? undefined} onChange={(v) => set({ locationId: v })} options={locationOptions} placeholder="分部" />
                    <input aria-label="借" inputMode="decimal" value={l.debit} onChange={(e) => set({ debit: e.target.value, credit: "" })} className="h-9 w-full rounded-lg border border-neutral-300 px-2 text-right text-sm tabular-nums" />
                    <input aria-label="貸" inputMode="decimal" value={l.credit} onChange={(e) => set({ credit: e.target.value, debit: "" })} className="h-9 w-full rounded-lg border border-neutral-300 px-2 text-right text-sm tabular-nums" />
                  </div>
                );
              })}
              <Button variant="link" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, blankLine()])}>
                ＋ 加一行
              </Button>
            </div>
            <div
              role="status"
              className={cn(
                "flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold",
                debitSum === creditSum && debitSum > 0 ? "bg-primary-100 text-primary-900" : "bg-warning-100 text-warning-950",
              )}
            >
              <span>{debitSum === creditSum && debitSum > 0 ? "借貸平衡" : "借貸還沒平衡"}</span>
              <span>
                借 <Amount cents={debitSum} decimals /> ／ 貸 <Amount cents={creditSum} decimals />
              </span>
            </div>
            <p className="text-[13px] text-neutral-500">現金請選某個資金帳戶的科目；跨分部的往來會自動補上。記錯只能沖銷。</p>
          </>
        )}
        {tab === "expense" && cents !== null && cents % 100 !== 0 && <p className="text-sm text-danger-700">支出金額請填整數元</p>}
        {error && <p className="text-sm text-danger-700">{error}</p>}
      </div>

      <div className="flex gap-2 border-t border-neutral-200 px-5 py-4">
        <Button variant="secondary" className="flex-1" onClick={onClose}>取消</Button>
        <Button className="flex-[2]" disabled={!valid} isLoading={busy} onClick={() => !busy && submit()}>記下來</Button>
      </div>
    </ResponsiveDialog>
  );
}
