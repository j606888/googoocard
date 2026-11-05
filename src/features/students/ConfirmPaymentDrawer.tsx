"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Select from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import Field, { FieldLabel } from "@/components/Field";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import {
  PaymentMethod,
  useConfirmStudentCardPaymentMutation,
} from "@/store/slices/students";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { defaultReceiverId } from "@/domains/finance/receiverDefault";

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
  const { data: memberships } = useGetMembershipsQuery(undefined, {
    skip: !target,
  });
  const { data: finance } = useGetFinanceSettingsQuery(undefined, {
    skip: !target,
  });
  const financeOn = !!finance?.enabled;
  const { data: locationsData } = useGetLocationsQuery(undefined, {
    skip: !target || !financeOn,
  });
  const [confirmPayment, { isLoading }] =
    useConfirmStudentCardPaymentMutation();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [receiverUserId, setReceiverUserId] = useState<number | null>(null);
  // null = follow the receiver's branch (server default); a number = overridden.
  const [soldLocationId, setSoldLocationId] = useState<number | null>(null);

  // Reset per card; the receiver defaults to whoever is confirming.
  useEffect(() => {
    if (!target) return;
    setMethod("CASH");
    setReference("");
    setReceiverUserId(null);
    setSoldLocationId(null);
  }, [target]);

  if (!target) return null;

  // 財務開啟：收款人只能是保管人；預設是自己（若自己是保管人），否則要選（不猜）。
  const financeIds = new Set(
    (finance?.members ?? []).filter((m) => m.isCustodian).map((m) => m.userId),
  );
  const defaultFinanceReceiver = defaultReceiverId({
    meId: me?.id,
    custodianIds: [...financeIds],
    keeperUserId: null,
  });
  const receiver =
    receiverUserId ?? (financeOn ? defaultFinanceReceiver : (me?.id ?? null));
  const locations = (locationsData?.locations ?? []).filter(
    (l) => !l.archivedAt,
  );

  const handleSubmit = async () => {
    try {
      await confirmPayment({
        id: target.studentId,
        studentCardId: target.studentCardId,
        paymentMethod: method,
        paymentReference:
          method === "TRANSFER" ? reference.trim() || null : null,
        receiverUserId: receiver ?? undefined,
        ...(financeOn && soldLocationId !== null ? { soldLocationId } : {}),
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
      disabled={financeOn && receiver === null}
      submitText={`已收到 $${formatMoney(target.finalPrice)}`}
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{target.cardName}</p>
            {target.serialNumber !== undefined && (
              <p className="text-xs text-neutral-500">
                {formatCardSerial(target.serialNumber)}
              </p>
            )}
          </div>
          <p className="text-lg font-bold">${formatMoney(target.finalPrice)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900">怎麼付的</p>
          <SegmentedTabs
            ariaLabel="付款方式"
            options={METHOD_OPTIONS}
            value={method}
            onChange={setMethod}
            fill
          />
        </div>

        {method === "TRANSFER" && (
          <Field
            label="轉帳末五碼"
            hint="（選填）"
            inputMode="numeric"
            maxLength={20}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="payment-receiver">錢現在在誰手上</FieldLabel>
          <Select
            id="payment-receiver"
            value={receiver ?? undefined}
            onChange={setReceiverUserId}
            placeholder="選收款人"
            options={(memberships ?? [])
              .filter((m) => !financeOn || financeIds.has(m.userId))
              .map((m) => ({
                value: m.userId,
                label:
                  m.userId === me?.id ? `${m.user.name}（我）` : m.user.name,
              }))}
          />
          <p className="text-xs text-neutral-500">
            {financeOn
              ? "只能選保管人；學生轉到其他保管人的帳戶就改選那位"
              : "預設是你自己；學生轉到其他老師的帳戶就改選那位老師"}
          </p>
        </div>

        {financeOn && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="payment-sold-location">賣卡分部</FieldLabel>
            <Select
              id="payment-sold-location"
              value={soldLocationId ?? undefined}
              onChange={setSoldLocationId}
              placeholder="依收款人的分部"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}
