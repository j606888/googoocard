"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { useCreateTransferMutation, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { financeErrorText, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

type Target = `user:${number}` | `teacher:${number}` | `venue:${number}` | "self";

/** 記一筆平常的轉帳（月結發錢請在結算單按「已轉」）。 */
export default function TransferForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { options: payers, allMembers, defaultUserId } = useFinanceMembers();
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: venueData } = useGetFinanceVenuesQuery();
  const [create, { isLoading }] = useCreateTransferMutation();

  const [from, setFrom] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const fromId = from ?? defaultUserId;
  const targets: { value: Target; label: string }[] = [
    { value: "self", label: "自己領走" },
    ...allMembers.filter((m) => m.userId !== fromId).map((m) => ({ value: `user:${m.userId}` as Target, label: m.name })),
    ...teachers.filter((t) => !t.archivedAt).map((t) => ({ value: `teacher:${t.id}` as Target, label: `${t.name}（老師）` })),
    ...(venueData?.venues ?? []).filter((v) => !v.archivedAt).map((v) => ({ value: `venue:${v.id}` as Target, label: `${v.name}（場地）` })),
  ];
  const chosen = target ?? "self";
  const amountNum = Number(amount);
  const valid = !!fromId && Number.isInteger(amountNum) && amountNum > 0 && !!date;

  const submit = async () => {
    setError("");
    const [kind, id] = chosen.split(":");
    try {
      await create({
        date,
        amount: amountNum,
        fromUserId: fromId,
        toKind: kind === "self" ? "SELF" : kind === "user" ? "USER" : kind === "teacher" ? "TEACHER" : "VENUE",
        ...(kind === "user" ? { toUserId: Number(id) } : {}),
        ...(kind === "teacher" ? { toTeacherId: Number(id) } : {}),
        ...(kind === "venue" ? { toVenueId: Number(id) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      toast.success("已記下這筆轉帳");
      setAmount("");
      setNote("");
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
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>轉給</FieldLabel>
          <Select value={chosen} onChange={(v) => setTarget(v)} options={targets} />
        </div>
        <Field label="金額" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="備註" hint="（選填）" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
