"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError } from "@/components/Field";
import { formatMoney } from "@/lib/money";
import { useCreatePackMutation, type FinanceVenue } from "@/store/slices/finance";
import { financeErrorText, todayKey } from "./financeUi";

const digits = (s: string) => s.replace(/\D/g, "");
const isWhole = (s: string, min: number) => s !== "" && Number.isInteger(Number(s)) && Number(s) >= min;

/**
 * 「＋買一包」（開帳後的日常）：這個場地買一包次數，之後每上一堂扣一次。
 * 不問誰付：一律從場地分部的負責人的錢付（伺服器決定）。開帳前手上的包在場地表單填。
 */
export default function PackForm({
  open,
  onClose,
  venue,
  payerText,
}: {
  open: boolean;
  onClose: () => void;
  venue: FinanceVenue | null;
  /** 「從 台南 負責人 丁丁 的錢付」；null＝場地沒分部或分部沒負責人（不能買）。 */
  payerText: string | null;
}) {
  const [create, { isLoading }] = useCreatePackMutation();
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState("");

  // 每次打開都回到預設，不留上一次填的內容
  useEffect(() => {
    if (!open) return;
    setSessions("");
    setPrice("");
    setDate(todayKey());
    setError("");
  }, [open]);

  const sessionsNum = Number(sessions);
  const priceNum = Number(price);
  const valid = !!venue && !!payerText && isWhole(sessions, 1) && isWhole(price, 0) && !!date;

  const submit = async () => {
    if (!venue) return;
    setError("");
    try {
      await create({ venueId: venue.id, sessions: sessionsNum, price: priceNum, purchasedAt: date }).unwrap();
      toast.success("已記下這一包");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  return (
    <Drawer
      title="買一包"
      subtitle={venue?.name}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitText="記下"
      isLoading={isLoading}
      disabled={!valid}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="次數" inputMode="numeric" value={sessions} onChange={(e) => setSessions(digits(e.target.value))} />
          <Field label="總價" inputMode="numeric" value={price} onChange={(e) => setPrice(digits(e.target.value))} />
        </div>
        <p className="text-sm text-neutral-700" aria-live="polite">
          {isWhole(sessions, 1) && isWhole(price, 0) ? `每次 $${formatMoney(priceNum / sessionsNum)}，每上一堂扣一次` : " "}
        </p>
        <Field label="購買日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="text-[13px] text-neutral-600">
          {payerText ?? "這個場地還沒選分部，或分部還沒有負責人，先設定好才能買"}
        </p>
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
