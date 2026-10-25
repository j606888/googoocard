"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import SegmentedTabs from "@/components/SegmentedTabs";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import {
  PaymentMethod,
  useConfirmStudentCardPaymentMutation,
} from "@/store/slices/students";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";

export interface ConfirmPaymentTarget {
  studentId: number;
  studentCardId: number;
  studentName: string;
  cardName: string;
  serialNumber?: number;
  finalPrice: number;
}

const METHOD_OPTIONS = [
  { value: "CASH", label: "現金" },
  { value: "TRANSFER", label: "轉帳" },
] as const;

/**
 * 確認收款：記下怎麼付的（現金／轉帳＋末五碼）和錢現在在誰手上（收款人，
 * 預設自己，學生轉到老師帳戶就改選老師）。收款人是水庫對帳要的資料。
 */
export default function ConfirmPaymentDrawer({
  target,
  onClose,
  onConfirmed,
}: {
  target: ConfirmPaymentTarget | null;
  onClose: () => void;
  onConfirmed?: () => void;
}) {
  const { data: me } = useGetMeQuery();
  const { data: memberships } = useGetMembershipsQuery(undefined, { skip: !target });
  const [confirmPayment, { isLoading }] = useConfirmStudentCardPaymentMutation();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [receiverUserId, setReceiverUserId] = useState<number | null>(null);

  // Reset per card; the receiver defaults to whoever is confirming.
  useEffect(() => {
    if (!target) return;
    setMethod("CASH");
    setReference("");
    setReceiverUserId(null);
  }, [target]);

  if (!target) return null;

  const receiver = receiverUserId ?? me?.id ?? null;

  const handleSubmit = async () => {
    try {
      await confirmPayment({
        id: target.studentId,
        studentCardId: target.studentCardId,
        paymentMethod: method,
        paymentReference: method === "TRANSFER" ? reference.trim() || null : null,
        receiverUserId: receiver ?? undefined,
      }).unwrap();
      toast.success("已確認收款");
      onConfirmed?.();
      onClose();
    } catch {
      toast.error("確認收款失敗");
    }
  };

  return (
    <Drawer
      open
      title="確認收款"
      subtitle={target.studentName}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitText={`已收到 $${formatMoney(target.finalPrice)}`}
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{target.cardName}</p>
            {target.serialNumber !== undefined && (
              <p className="text-xs text-neutral-500">{formatCardSerial(target.serialNumber)}</p>
            )}
          </div>
          <p className="text-lg font-bold">${formatMoney(target.finalPrice)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-medium">怎麼付的</p>
          <SegmentedTabs
            ariaLabel="付款方式"
            options={METHOD_OPTIONS}
            value={method}
            onChange={setMethod}
            fill
          />
        </div>

        {method === "TRANSFER" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="payment-reference" className="font-medium">
              轉帳末五碼 <span className="text-sm font-normal text-neutral-500">（選填）</span>
            </label>
            <input
              id="payment-reference"
              className="w-full rounded bg-neutral-100 p-2 tracking-widest focus:outline-primary-500"
              inputMode="numeric"
              maxLength={20}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="payment-receiver" className="font-medium">
            錢現在在誰手上
          </label>
          <select
            id="payment-receiver"
            className="w-full rounded bg-neutral-100 p-2 focus:outline-primary-500"
            value={receiver ?? ""}
            onChange={(e) => setReceiverUserId(Number(e.target.value))}
          >
            {(memberships ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
                {m.userId === me?.id ? "（我）" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">預設是你自己；學生轉到其他老師的帳戶就改選那位老師</p>
        </div>
      </div>
    </Drawer>
  );
}
