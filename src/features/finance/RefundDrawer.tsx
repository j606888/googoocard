"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { formatMoney } from "@/lib/money";
import { useRefundCardMutation } from "@/store/slices/finance";
import { financeErrorText, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

/** 退費：退多少、誰把錢退出去、哪一天。退完這張卡就關閉，剩下的價值依規定算過期收入。 */
export default function RefundDrawer({
  open,
  onClose,
  studentCard,
}: {
  open: boolean;
  onClose: () => void;
  studentCard: { id: number; finalPrice: number; totalSessions: number; remainingSessions: number; cardName: string };
}) {
  const { options, defaultUserId } = useFinanceMembers();
  const [refund, { isLoading }] = useRefundCardMutation();
  const max = Math.floor((studentCard.finalPrice * studentCard.remainingSessions) / studentCard.totalSessions);
  const [amount, setAmount] = useState(String(max));
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState("");

  const payer = paidBy ?? defaultUserId;
  const amountNum = Number(amount);
  const valid = amount !== "" && Number.isInteger(amountNum) && amountNum >= 0 && amountNum <= max && !!payer && !!date;

  const submit = async () => {
    setError("");
    try {
      await refund({ studentCardId: studentCard.id, amount: amountNum, paidByUserId: payer, date }).unwrap();
      toast.success("已退費，這張卡已關閉");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "退費失敗，請再試一次"));
    }
  };

  return (
    <Drawer
      title="退費"
      subtitle={studentCard.cardName}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitText="確認退費"
      variant="danger"
      isLoading={isLoading}
      disabled={!valid}
    >
      <div className="flex flex-col gap-4">
        <Field
          label="退款金額"
          hint={`（最多 $${formatMoney(max)}，剩下 ${studentCard.remainingSessions} 堂的價值）`}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>誰退的錢</FieldLabel>
          <Select value={payer} onChange={(v) => setPaidBy(v)} options={options} placeholder="選一位" />
        </div>
        <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="text-[13px] text-neutral-500">退費後這張卡會關閉，剩下的堂數不能再用。</p>
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
