"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import { formatMoney } from "@/lib/money";
import { useCreatePackMutation, useGetFinanceVenuesQuery } from "@/store/slices/finance";
import { financeErrorText, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

type Mode = "new" | "before";
const MODES = [
  { value: "new", label: "買一包" },
  { value: "before", label: "之前買的還剩幾次" },
] as const;

const digits = (s: string) => s.replace(/\D/g, "");
const isWhole = (s: string, min: number) => s !== "" && Number.isInteger(Number(s)) && Number(s) >= min;

/**
 * 場地次數包：先付一筆，之後每上一堂從包裡扣。
 * 「之前買的還剩幾次」給開帳用：價值＝包價 ÷ 總次數 × 剩下次數，視為上線前已付。
 */
export default function PackForm({
  open,
  onClose,
  allowBefore = false,
  selfOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  /** 開帳（財務設定）才顯示「之前買的還剩幾次」。 */
  allowBefore?: boolean;
  /** 保管人（不能結算）：付款人固定是自己。 */
  selfOnly?: boolean;
}) {
  const { data } = useGetFinanceVenuesQuery();
  const { options: payers, defaultUserId, meId } = useFinanceMembers();
  const [create, { isLoading }] = useCreatePackMutation();
  const venues = (data?.venues ?? []).filter((v) => !v.archivedAt);

  const [mode, setMode] = useState<Mode>("new");
  const [venueId, setVenueId] = useState<number | null>(null);
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");
  const [remaining, setRemaining] = useState("");
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState("");

  const venue = venueId ?? venues[0]?.id ?? null;
  // 保管人（不能結算）付款人固定是自己
  const payer = selfOnly ? (meId ?? 0) : (paidBy ?? defaultUserId);
  const sessionsNum = Number(sessions);
  const priceNum = Number(price);
  const remainingNum = Number(remaining);
  const baseValid = !!venue && isWhole(sessions, 1) && isWhole(price, 0) && !!payer;
  const valid =
    mode === "new" ? baseValid && !!date : baseValid && isWhole(remaining, 1) && remainingNum <= sessionsNum;
  const remainingValue = valid && mode === "before" ? Math.round((priceNum * remainingNum) / sessionsNum) : null;

  const submit = async () => {
    setError("");
    try {
      await create(
        mode === "new"
          ? { venueId: venue!, sessions: sessionsNum, price: priceNum, paidByUserId: payer, purchasedAt: date }
          : {
              venueId: venue!,
              paidByUserId: payer,
              before: { totalSessions: sessionsNum, totalPrice: priceNum, remaining: remainingNum },
            },
      ).unwrap();
      toast.success("已記下次數包");
      setSessions("");
      setPrice("");
      setRemaining("");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  return (
    <Drawer
      title={allowBefore ? "次數包" : "買次數包"}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitText="記下"
      isLoading={isLoading}
      disabled={!valid}
    >
      <div className="flex flex-col gap-4">
        {allowBefore && (
          <SegmentedTabs ariaLabel="次數包類型" options={MODES} value={mode} onChange={setMode} fill />
        )}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>場地</FieldLabel>
          <Select
            value={venue ?? undefined}
            onChange={(v) => setVenueId(v)}
            options={venues.map((v) => ({ value: v.id, label: v.name }))}
            placeholder="選場地"
          />
        </div>
        <Field
          label={mode === "new" ? "次數" : "這包總共幾次"}
          inputMode="numeric"
          value={sessions}
          onChange={(e) => setSessions(digits(e.target.value))}
        />
        <Field
          label={mode === "new" ? "總價" : "這包的價錢"}
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(digits(e.target.value))}
        />
        {mode === "before" && (
          <div className="flex flex-col gap-1.5">
            <Field
              label="還剩幾次"
              inputMode="numeric"
              value={remaining}
              onChange={(e) => setRemaining(digits(e.target.value))}
            />
            <p className="flex items-center gap-1 text-[13px] text-neutral-600">
              {remainingValue !== null ? `記成 ${remaining} 次、$${formatMoney(remainingValue)}` : " "}
              <InfoTip label="之前買的次數包說明">
                價值＝這包的價錢 ÷ 總次數 × 還剩幾次，日期記在上線前一天（視為上線前已付）。上課時先用這包。
              </InfoTip>
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <FieldLabel>誰付的</FieldLabel>
          {selfOnly ? (
            <p className="text-sm text-neutral-900">{payers.find((o) => o.value === payer)?.label ?? "自己"}（自己）</p>
          ) : (
            <Select value={payer} onChange={(v) => setPaidBy(v)} options={payers} placeholder="選一位" />
          )}
        </div>
        {mode === "new" && (
          <Field label="購買日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
