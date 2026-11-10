"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { FieldError, FieldLabel } from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { financeRoleLabel } from "./roleLabel";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { useEnableFinanceMutation, useGetFinanceSettingsQuery } from "@/store/slices/finance";

const ERRORS: Record<string, string> = {
  FINANCE_ALREADY_ENABLED: "這間教室已經開過財務了",
  NOT_A_MEMBER: "選的人不是這間教室的成員",
};

/** 沒開財務時 /finance 的內容：owner 看到開啟表單，其他人只看到說明。 */
export default function EnableFinance() {
  const { data: classrooms } = useGetClassroomsQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const [enable, { isLoading }] = useEnableFinanceMutation();
  const [custodian, setCustodian] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isOwner = classrooms?.classrooms.find((c) => c.id === classrooms.currentClassroomId)?.role === "owner";
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center gap-2">
        <EmptyState kind="page" title="這間教室還沒開財務" description="請教室擁有者到這裡開啟。" />
        <GuideCta />
      </div>
    );
  }

  const members = settings?.members ?? [];
  // 不預設：舊卡的錢常常不在開財務的人手上，要明確選一位。
  const holder = custodian ?? 0;

  const submit = async () => {
    setError("");
    try {
      await enable({ legacyCustodianUserId: holder }).unwrap();
      toast.success("財務已開啟，先把開帳設定做完");
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      setError((code && ERRORS[code]) || "開啟失敗，請再試一次");
    }
  };

  return (
    <div className="flex max-w-[560px] flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-1">
        <h1 className="text-lg font-bold text-neutral-900">開啟財務</h1>
        <InfoTip label="開啟財務說明">
          開啟後先把開帳設定做完；財務從開帳時選的轉換日開始算，轉換日之前的課不進財務。
          開帳時，還有剩格的舊卡會設成轉換日 6 個月後到期。舊卡的錢算在下面選的人手上，他也會成為保管人。
        </InfoTip>
      </div>
      <GuideCta />
      <div className="flex flex-col gap-1.5">
        <FieldLabel>舊卡的錢在誰手上</FieldLabel>
        <Select
          value={holder || undefined}
          onChange={(v) => setCustodian(v)}
          options={members.map((m) => ({
            value: m.userId,
            label: m.name,
            hint: [financeRoleLabel(m.role), m.teacherName && `老師「${m.teacherName}」`].filter(Boolean).join(" · "),
          }))}
          placeholder="選一位"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button onClick={submit} disabled={!holder || isLoading}>
        開啟財務
      </Button>
    </div>
  );
}

/** 開財務前先看教學：財務怎麼運作、開了之後要做哪些事。 */
function GuideCta() {
  return (
    <Link
      href="/finance/guide"
      target="_blank"
      rel="noopener"
      className="flex flex-col gap-0.5 rounded-2xl border border-primary-300 bg-primary-50 px-4 py-3 text-primary-900 hover:border-primary-300"
    >
      <span className="text-[15px] font-semibold">第一次用財務？先看使用教學（開新分頁）</span>
      <span className="text-[13px] text-primary-800">15 分鐘看懂錢怎麼流、開了之後要設定哪些東西、常卡住的地方。</span>
    </Link>
  );
}
