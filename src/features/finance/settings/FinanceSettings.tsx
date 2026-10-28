"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetFinanceSettingQuery,
  useGetSettingHistoryQuery,
  usePatchFinanceSettingMutation,
} from "@/store/slices/finance";
import { MoneyInput, Panel } from "../ui";
import { dayLabel, errorText, money, parseMoneyInput } from "../format";
import HistoryDialog from "../HistoryDialog";

/**
 * 水庫設定。換營收負責人要有 finance.edit；期初數字營收負責人也能改。
 * 換人、改期初數字都要寫原因，留修改紀錄。
 */
export default function FinanceSettings() {
  const { data } = useGetFinanceSettingQuery();
  const { data: history } = useGetSettingHistoryQuery();
  const [patch, patching] = usePatchFinanceSettingMutation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const setting = data?.setting;
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loan, setLoan] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!data || !setting?.startDate) return <Skeleton className="h-60 w-full max-w-[560px] rounded-2xl" />;
  const canChange = data.canEdit || data.isRevenueOwner;

  const owner = ownerId ?? setting.revenueOwnerUserId!;
  const balanceText = balance ?? String(setting.openingBalance);
  const loanText = loan ?? (setting.openingOwnerLoan === null ? "" : String(setting.openingOwnerLoan));
  const overdueText = overdue ?? String(setting.overdueDays);

  const nextLoan = loanText.trim() === "" ? null : parseMoneyInput(loanText);
  const nextBalance = parseMoneyInput(balanceText);
  const needsReason =
    owner !== setting.revenueOwnerUserId || nextBalance !== setting.openingBalance || nextLoan !== setting.openingOwnerLoan;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const days = Number(overdueText);
    if (nextBalance === null) return setError("期初餘額要填數字");
    if (!Number.isInteger(days) || days < 1 || days > 90) return setError("天數填 1 到 90");
    if (needsReason && !reason.trim()) return setError("換營收負責人、改期初數字要寫原因");
    try {
      await patch({
        ...(owner !== setting.revenueOwnerUserId ? { revenueOwnerUserId: owner } : {}),
        openingBalance: nextBalance,
        openingOwnerLoan: nextLoan,
        overdueDays: days,
        ...(needsReason ? { reason: reason.trim() } : {}),
      }).unwrap();
      toast.success("存好了");
      setReason("");
      setOwnerId(null);
      setBalance(null);
      setLoan(null);
      setOverdue(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <Panel title="水庫設定" action={history && history.length > 0 && (
        <Button variant="link" size="sm" onClick={() => setHistoryOpen(true)}>
          修改紀錄（{history.length}）
        </Button>
      )}>
        <p className="text-[13px] text-neutral-500">從 {dayLabel(setting.startDate)} 開始記帳。</p>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="owner">營收負責人</FieldLabel>
            <Select<number>
              id="owner"
              value={owner}
              onChange={setOwnerId}
              disabled={!data.canEdit}
              options={data.members.map((m) => ({ value: m.id, label: m.name }))}
            />
            {!data.canEdit && <span className="text-[13px] text-neutral-500">換人要請管理員來改</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="opening-balance">期初餘額</FieldLabel>
            <MoneyInput id="opening-balance" value={balanceText} onChange={setBalance} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="opening-loan" hint="（選填，空著就不顯示建城貸款）">
              建城貸款（啟用前老闆放進來的錢）
            </FieldLabel>
            <MoneyInput id="opening-loan" value={loanText} onChange={setLoan} placeholder="" />
          </div>
          <Field
            label="手上的錢超過幾天沒繳就標紅"
            inputMode="numeric"
            value={overdueText}
            onChange={(e) => setOverdue(e.target.value.replace(/\D/g, ""))}
          />
          {needsReason && <Field label="為什麼要改" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如 漏算現金" />}
          {needsReason && (
            <p className="text-[13px] text-neutral-500">
              {nextBalance !== setting.openingBalance && `期初餘額 ${money(setting.openingBalance)} → ${money(nextBalance ?? 0)}。`}
            </p>
          )}
          <FieldError>{error}</FieldError>
          {canChange && (
            <Button type="submit" isLoading={patching.isLoading} className="self-start">
              儲存
            </Button>
          )}
        </form>
      </Panel>
      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="設定修改紀錄" revisions={history} members={data.members} />
    </div>
  );
}
