"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  useGetFinanceSettingsQuery,
  useGetStrayReceiversQuery,
  useReassignStrayReceiversMutation,
  useRestoreStrayReceiversMutation,
  type ReassignedReceiverItem,
  type StrayReceiverItem,
} from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const rowKey = (i: { kind: string; id: number }) => `${i.kind}:${i.id}`;
const shortDate = (d: string) => d.slice(5).replace("-", "/");
const what = (i: { kind: string; label: string }) => (i.kind === "dropIn" ? `單堂 ${i.label}` : i.label);
/** 0 = 先不改 */
const SKIP = 0;

/**
 * 開帳：收款人不是保管人的已付款卡／單堂（上線後收的，和上線前還有剩格的卡）。
 * 依「誰收的」分組，每筆選要改給哪位保管人（草稿）→ 下方總覽 → 一次確認改記。
 * 改記過的列在「已改記」，留著原收款人，可以復原。
 */
export default function StrayReceivers() {
  const { data } = useGetStrayReceiversQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const { options } = useFinanceMembers();
  const [reassign, { isLoading }] = useReassignStrayReceiversMutation();
  const [targets, setTargets] = useState<Map<string, number>>(new Map());

  if (!data) return <Skeleton className="h-10 w-full rounded-xl" />;
  const items = data.items;
  const reassigned = data.reassigned ?? [];

  const legacy = settings?.legacyCustodianUserId;
  const defaultTarget = options.find((o) => o.value === legacy)?.value ?? options[0]?.value ?? SKIP;
  const targetOf = (i: StrayReceiverItem) => targets.get(rowKey(i)) ?? defaultTarget;
  const nameOf = (userId: number) => options.find((o) => o.value === userId)?.label ?? "";
  const rowOptions = [...options, { value: SKIP, label: "先不改" }];

  const setTarget = (rows: StrayReceiverItem[], userId: number) =>
    setTargets((prev) => {
      const next = new Map(prev);
      for (const r of rows) next.set(rowKey(r), userId);
      return next;
    });

  // 依收款人分組（保持清單順序）
  const groups = new Map<number, StrayReceiverItem[]>();
  for (const i of items) groups.set(i.receiverUserId, [...(groups.get(i.receiverUserId) ?? []), i]);

  // 總覽：誰收的 → 改給誰
  const moves = new Map<string, { from: string; to: number; rows: StrayReceiverItem[] }>();
  for (const i of items) {
    const to = targetOf(i);
    if (to === SKIP) continue;
    const k = `${i.receiverUserId}>${to}`;
    const m = moves.get(k) ?? { from: i.receiverName, to, rows: [] };
    m.rows.push(i);
    moves.set(k, m);
  }
  const chosen = [...moves.values()];

  const submit = async () => {
    const byTarget = new Map<number, StrayReceiverItem[]>();
    for (const m of chosen) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), ...m.rows]);
    try {
      await reassign({
        moves: [...byTarget].map(([toUserId, rows]) => ({
          toUserId,
          cardIds: rows.filter((r) => r.kind === "card").map((r) => r.id),
          dropInIds: rows.filter((r) => r.kind === "dropIn").map((r) => r.id),
        })),
      }).unwrap();
      setTargets(new Map());
      toast.success("已改記到保管人名下");
    } catch (e) {
      toast.error(financeErrorText(e, "改不了，請再試一次"));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">收的錢都記在保管人名下</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {[...groups.values()].map((rows) => {
              const total = rows.reduce((s, r) => s + r.amount, 0);
              return (
                <section key={rows[0].receiverUserId} className="flex flex-col">
                  <h4 className="text-sm font-medium text-neutral-900">
                    {rows[0].receiverName} 收的 · {rows.length} 筆 ${formatMoney(total)}
                  </h4>
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {rows.map((i) => (
                      <li key={rowKey(i)} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-neutral-900">
                            {shortDate(i.date)} · {i.studentName}
                          </span>
                          <span className="truncate text-[13px] text-neutral-600">
                            {what(i)} · ${formatMoney(i.amount)}
                            {i.collectedByName && i.collectedByName !== i.receiverName
                              ? ` · 原本 ${i.collectedByName} 收`
                              : ""}
                          </span>
                        </span>
                        <div className="w-32 shrink-0">
                          <Select
                            size="sm"
                            aria-label={`${i.studentName} 改給誰`}
                            value={targetOf(i)}
                            onChange={(v) => setTarget([i], v)}
                            options={rowOptions}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
            {chosen.length === 0 ? (
              <p className="text-sm text-neutral-500">還沒選要改給誰</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-neutral-900">
                {chosen.map((m) => (
                  <li key={`${m.from}>${m.to}`} className="tabular-nums">
                    {m.from} 的 {m.rows.length} 筆 ${formatMoney(m.rows.reduce((s, r) => s + r.amount, 0))} →{" "}
                    {nameOf(m.to)}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Button variant="secondary" disabled={isLoading || chosen.length === 0} onClick={submit}>
                確認改記
              </Button>
            </div>
          </div>
        </>
      )}

      {reassigned.length > 0 && <Reassigned rows={reassigned} />}
    </div>
  );
}

function Reassigned({ rows }: { rows: ReassignedReceiverItem[] }) {
  const [restore, { isLoading }] = useRestoreStrayReceiversMutation();
  const undo = async (i: ReassignedReceiverItem) => {
    try {
      await restore({
        cardIds: i.kind === "card" ? [i.id] : [],
        dropInIds: i.kind === "dropIn" ? [i.id] : [],
      }).unwrap();
      toast.success(`已還給 ${i.collectedByName}`);
    } catch (e) {
      toast.error(financeErrorText(e, "復原不了，請再試一次"));
    }
  };

  return (
    <section className="flex flex-col">
      <h4 className="text-sm font-medium text-neutral-900">已改記</h4>
      <ul className="flex flex-col divide-y divide-neutral-100">
        {rows.map((i) => (
          <li key={rowKey(i)} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-neutral-900">
                {i.collectedByName} → {i.holderName}
              </span>
              <span className="truncate text-[13px] text-neutral-600">
                {shortDate(i.date)} · {i.studentName} · {what(i)} · ${formatMoney(i.amount)}
              </span>
            </span>
            <Button variant="ghost" size="sm" disabled={isLoading} onClick={() => undo(i)}>
              復原
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
