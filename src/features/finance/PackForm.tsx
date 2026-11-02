"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { useCreatePackMutation, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import { financeErrorText, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

/** 買場地次數包：先付一筆，之後每上一堂從包裡扣。 */
export default function PackForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useGetFinanceVenuesQuery();
  const { options: payers, defaultUserId } = useFinanceMembers();
  const [create, { isLoading }] = useCreatePackMutation();
  const venues = (data?.venues ?? []).filter((v) => !v.archivedAt);

  const [venueId, setVenueId] = useState<number | null>(null);
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState("");

  const venue = venueId ?? venues[0]?.id ?? null;
  const payer = paidBy ?? defaultUserId;
  const sessionsNum = Number(sessions);
  const priceNum = Number(price);
  const valid = !!venue && Number.isInteger(sessionsNum) && sessionsNum >= 1 && price !== "" && Number.isInteger(priceNum) && !!payer && !!date;

  const submit = async () => {
    setError("");
    try {
      await create({ venueId: venue!, sessions: sessionsNum, price: priceNum, paidByUserId: payer, purchasedAt: date }).unwrap();
      toast.success("已記下次數包");
      setSessions("");
      setPrice("");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  return (
    <Drawer title="買次數包" open={open} onClose={onClose} onSubmit={submit} submitText="記下" isLoading={isLoading} disabled={!valid}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>場地</FieldLabel>
          <Select
            value={venue ?? undefined}
            onChange={(v) => setVenueId(v)}
            options={venues.map((v) => ({ value: v.id, label: v.name }))}
            placeholder="選場地"
          />
        </div>
        <Field label="次數" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/\D/g, ""))} />
        <Field label="總價" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>誰付的</FieldLabel>
          <Select value={payer} onChange={(v) => setPaidBy(v)} options={payers} placeholder="選一位" />
        </div>
        <Field label="購買日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
