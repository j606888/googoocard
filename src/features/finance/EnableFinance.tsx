"use client";

import { useState } from "react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { useEnableFinanceMutation, useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";
import { todayKey } from "./financeUi";

const ERRORS: Record<string, string> = {
  FINANCE_ALREADY_ENABLED: "這間教室已經開過財務了",
  NOT_A_MEMBER: "選的人不是這間教室的成員",
};

/** 沒開財務時 /finance 的內容：owner 看到開啟表單，其他人只看到說明。 */
export default function EnableFinance() {
  const { data: classrooms } = useGetClassroomsQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data: me } = useGetMeQuery();
  const [enable, { isLoading }] = useEnableFinanceMutation();
  const [launchDate, setLaunchDate] = useState(todayKey());
  const [custodian, setCustodian] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isOwner = classrooms?.classrooms.find((c) => c.id === classrooms.currentClassroomId)?.role === "owner";
  if (!isOwner) {
    return <EmptyState kind="page" title="這間教室還沒開財務" description="請教室擁有者到這裡開啟。" />;
  }

  const members = settings?.members ?? [];
  const holder = custodian ?? (members.find((m) => m.userId === me?.id)?.userId ?? members[0]?.userId ?? 0);

  const submit = async () => {
    setError("");
    try {
      await enable({ launchDate, legacyCustodianUserId: holder }).unwrap();
      toast.success("財務已開啟，先把開帳清單做完");
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      setError((code && ERRORS[code]) || "開啟失敗，請再試一次");
    }
  };

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-1">
        <h1 className="text-lg font-bold text-neutral-900">開啟財務</h1>
        <InfoTip label="開啟財務說明">
          從上線日開始算：上線日之前的課不進財務。開啟後所有還有剩格的課卡會在上線日 6 個月後到期，
          舊卡的錢算在下面選的人手上。
        </InfoTip>
      </div>
      <Field label="上線日" type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <FieldLabel>舊卡的錢在誰手上</FieldLabel>
        <Select
          value={holder || undefined}
          onChange={(v) => setCustodian(v)}
          options={members.map((m) => ({ value: m.userId, label: m.name }))}
          placeholder="選一位"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button onClick={submit} disabled={!launchDate || !holder || isLoading}>
        開啟財務
      </Button>
    </div>
  );
}
