"use client";

import { useState } from "react";
import { toast } from "sonner";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  useGetFinanceSettingsQuery,
  useGetStrayReceiversQuery,
  useReassignStrayReceiversMutation,
} from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const rowKey = (i: { kind: string; id: number }) => `${i.kind}:${i.id}`;

/**
 * 開帳：上線後收款人不是保管人的已付款卡／單堂，勾選後一鍵改記到一位保管人。
 * 預設全選、改記到舊卡保管人；不同分部的錢可以分兩次改給各自的負責人。
 */
export default function StrayReceivers() {
  const { data } = useGetStrayReceiversQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const { options } = useFinanceMembers();
  const [reassign, { isLoading }] = useReassignStrayReceiversMutation();
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<number | null>(null);
  const items = data?.items ?? [];

  if (!data) return null;
  if (items.length === 0) return <p className="text-sm text-neutral-500">上線後收的錢都記在保管人名下</p>;

  const legacy = settings?.legacyCustodianUserId;
  const defaultTarget = options.find((o) => o.value === legacy)?.value ?? options[0]?.value ?? 0;
  const toUserId = target ?? defaultTarget;
  const selected = items.filter((i) => !unchecked.has(rowKey(i)));
  const total = selected.reduce((s, i) => s + i.amount, 0);

  const toggle = (key: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = async () => {
    try {
      await reassign({
        toUserId,
        cardIds: selected.filter((i) => i.kind === "card").map((i) => i.id),
        dropInIds: selected.filter((i) => i.kind === "dropIn").map((i) => i.id),
      }).unwrap();
      setUnchecked(new Set());
      toast.success("已改記到保管人名下");
    } catch (e) {
      toast.error(financeErrorText(e, "改不了，請再試一次"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {items.map((i) => {
          const key = rowKey(i);
          return (
            <li key={key}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary-700"
                  checked={!unchecked.has(key)}
                  onChange={() => toggle(key)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-neutral-900">
                    {i.studentName}・{i.kind === "dropIn" ? `單堂 ${i.label}` : i.label}
                  </span>
                  <span className="text-[13px] text-neutral-600">
                    {i.date.slice(5).replace("-", "/")} 收款人 {i.receiverName}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-neutral-900">${formatMoney(i.amount)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-48">
          <Select
            aria-label="改記到哪位保管人"
            value={toUserId || undefined}
            onChange={(v) => setTarget(v)}
            options={options}
            placeholder="選一位保管人"
          />
        </div>
        <Button variant="secondary" disabled={isLoading || !toUserId || selected.length === 0} onClick={submit}>
          {selected.length} 筆 ${formatMoney(total)} 改記到這位
        </Button>
      </div>
    </div>
  );
}
