"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { formatMoney } from "@/lib/money";
import {
  useCreateTransferMutation,
  useGetFinanceTransfersQuery,
  useGetFinanceVenuesQuery,
  useGetMonthStatementQuery,
  useGetSettlementMonthsQuery,
} from "@/store/slices/finance";
import type { TransferKind } from "@/store/slices/finance";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { financeErrorText, monthLabel, pendingPayoutFor, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

type Target = `user:${number}` | `teacher:${number}` | `venue:${number}` | "self";

const KIND: Record<string, TransferKind> = { self: "SELF", user: "USER", teacher: "TEACHER", venue: "VENUE" };

/** "user:1" → { toKind: "USER", toUserId: 1 } */
function parseTarget(t: Target) {
  const [kind, raw] = t.split(":");
  const id = Number(raw);
  return {
    toKind: KIND[kind],
    ...(kind === "user" ? { toUserId: id } : {}),
    ...(kind === "teacher" ? { toTeacherId: id } : {}),
    ...(kind === "venue" ? { toVenueId: id } : {}),
  };
}

/** 記一筆平常的轉帳（月結發錢請在結算單按「已完成」）。 */
export default function TransferForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { options: payers, allMembers, defaultUserId, meId } = useFinanceMembers();
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: venueData } = useGetFinanceVenuesQuery();
  const { data: months } = useGetSettlementMonthsQuery(undefined, { skip: !open });
  const { data: transferData } = useGetFinanceTransfersQuery(undefined, { skip: !open });
  // 最近一個已結算的月份：結算單上還沒按「已完成」的錢，最常被重複記
  const lastLocked = (months?.months ?? [])
    .filter((m) => m.locked)
    .map((m) => m.month)
    .sort()
    .at(-1);
  const { data: lockedStatement } = useGetMonthStatementQuery(lastLocked ?? "", { skip: !open || !lastLocked });
  const [create, { isLoading }] = useCreateTransferMutation();

  const [from, setFrom] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // 每次打開都回到預設：「轉給」不沿用上一次，一定要自己選
  useEffect(() => {
    if (!open) return;
    setFrom(null);
    setTarget(null);
    setAmount("");
    setDate(todayKey());
    setNote("");
    setError("");
  }, [open]);

  const fromId = from ?? defaultUserId;
  const targets: { value: Target; label: string }[] = [
    { value: "self", label: "自己領走" },
    ...allMembers.filter((m) => m.userId !== fromId).map((m) => ({ value: `user:${m.userId}` as Target, label: m.name })),
    ...teachers.filter((t) => !t.archivedAt).map((t) => ({ value: `teacher:${t.id}` as Target, label: `${t.name}（老師）` })),
    ...(venueData?.venues ?? []).filter((v) => !v.archivedAt).map((v) => ({ value: `venue:${v.id}` as Target, label: `${v.name}（場地）` })),
  ];
  const amountNum = Number(amount);
  const valid = !!fromId && !!target && Number.isInteger(amountNum) && amountNum > 0 && !!date;

  const pending =
    target && fromId && lastLocked && lockedStatement
      ? pendingPayoutFor(lockedStatement.payouts, transferData?.transfers ?? [], lastLocked, fromId, parseTarget(target))
      : null;
  const nameOf = (id: number) => payers.find((o) => o.value === id)?.label ?? "成員";
  const targetLabel = targets.find((t) => t.value === target)?.label ?? "";

  const submit = async () => {
    if (!target) return;
    setError("");
    try {
      await create({
        date,
        amount: amountNum,
        fromUserId: fromId,
        ...parseTarget(target),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      toast.success("已記下這筆轉帳");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  return (
    <Drawer title="記一筆轉帳" open={open} onClose={onClose} onSubmit={submit} submitText="記下" isLoading={isLoading} disabled={!valid}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>誰轉出</FieldLabel>
          <Select value={fromId} onChange={(v) => { setFrom(v); setTarget(null); }} options={payers} placeholder="選一位" />
          {meId !== null && !!fromId && fromId !== meId && (
            <p className="text-[13px] text-warning-800">這筆記成 {nameOf(fromId)} 轉出的錢</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>轉給</FieldLabel>
          <Select value={target ?? undefined} onChange={(v) => setTarget(v)} options={targets} placeholder="選一位" />
        </div>
        {pending && lastLocked && (
          <div className="flex flex-col gap-1 rounded-lg bg-warning-100 px-3 py-2 text-sm text-warning-950">
            <p>
              {monthLabel(lastLocked)}的結算單上有一筆 {nameOf(pending.payout.fromUserId)} → {targetLabel} $
              {formatMoney(pending.remaining)} 還沒按「已完成」。如果這次轉的就是它，請到結算單按「已完成」，不用在這裡記。
            </p>
            <Link href={`/finance/settle/${lastLocked}`} className="font-medium underline underline-offset-4" onClick={onClose}>
              去結算單按已完成
            </Link>
          </div>
        )}
        <Field label="金額" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="備註" hint="（選填，例如 LINE Pay、11 月薪水）" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
