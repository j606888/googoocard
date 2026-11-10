"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
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
import { useOpeningDraftDate } from "./v2/Opening";

const rowKey = (i: { kind: string; id: number }) => `${i.kind}:${i.id}`;
const shortDate = (d: string) => d.slice(5).replace("-", "/");
const what = (i: { kind: string; label: string }) => (i.kind === "dropIn" ? `單堂 ${i.label}` : i.label);
const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
/** 0 = 先不改 */
const SKIP = 0;

/**
 * 開帳：收款人不是保管人的已付款卡／單堂（轉換日後收的，和轉換日還有預收的舊卡；在精靈裡照草稿的轉換日）。
 * 左邊依「誰收的」分組，整組一次選要改給哪位保管人（展開可逐筆改）；
 * 右邊即時預覽「改記後」每位保管人多了多少 → 一次確認改記。手機上預覽放在清單上方
 * （精靈的「下一步」已經貼底，不再疊第二條）。改記過的列在「已改記」，留著原收款人，可以復原。
 */
export default function StrayReceivers() {
  const conversionDate = useOpeningDraftDate();
  const { data } = useGetStrayReceiversQuery(conversionDate ? { conversionDate } : undefined);
  const { data: settings } = useGetFinanceSettingsQuery();
  const { options } = useFinanceMembers();
  const [reassign, { isLoading }] = useReassignStrayReceiversMutation();
  /** 整組的選擇（收款人 userId → 保管人 userId／SKIP） */
  const [groupTargets, setGroupTargets] = useState<Map<number, number>>(new Map());
  /** 逐筆覆寫 */
  const [rowTargets, setRowTargets] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState<Set<number>>(new Set());

  if (!data) return <Skeleton className="h-10 w-full rounded-xl" />;
  const items = data.items;
  const reassigned = data.reassigned ?? [];

  const legacy = settings?.legacyCustodianUserId;
  const defaultTarget = options.find((o) => o.value === legacy)?.value ?? options[0]?.value ?? SKIP;
  const groupTargetOf = (receiverUserId: number) => groupTargets.get(receiverUserId) ?? defaultTarget;
  const targetOf = (i: StrayReceiverItem) => rowTargets.get(rowKey(i)) ?? groupTargetOf(i.receiverUserId);
  const nameOf = (userId: number) => options.find((o) => o.value === userId)?.label ?? "";
  const targetOptions = [...options, { value: SKIP, label: "先不改" }];

  const setGroup = (receiverUserId: number, rows: StrayReceiverItem[], userId: number) => {
    setGroupTargets((prev) => new Map(prev).set(receiverUserId, userId));
    setRowTargets((prev) => {
      const next = new Map(prev);
      for (const r of rows) next.delete(rowKey(r));
      return next;
    });
  };
  const setRow = (i: StrayReceiverItem, userId: number) =>
    setRowTargets((prev) => {
      const next = new Map(prev);
      if (userId === groupTargetOf(i.receiverUserId)) next.delete(rowKey(i));
      else next.set(rowKey(i), userId);
      return next;
    });
  const toggle = (receiverUserId: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(receiverUserId)) next.add(receiverUserId);
      return next;
    });

  // 依收款人分組（保持清單順序）
  const groups = new Map<number, StrayReceiverItem[]>();
  for (const i of items) groups.set(i.receiverUserId, [...(groups.get(i.receiverUserId) ?? []), i]);

  // 預覽：改給誰 → 多少、從誰那來
  const byTarget = new Map<number, StrayReceiverItem[]>();
  const skipped: StrayReceiverItem[] = [];
  for (const i of items) {
    const to = targetOf(i);
    if (to === SKIP) skipped.push(i);
    else byTarget.set(to, [...(byTarget.get(to) ?? []), i]);
  }
  const moving = [...byTarget.values()].flat();

  const submit = async () => {
    try {
      await reassign({
        moves: [...byTarget].map(([toUserId, rows]) => ({
          toUserId,
          cardIds: rows.filter((r) => r.kind === "card").map((r) => r.id),
          dropInIds: rows.filter((r) => r.kind === "dropIn").map((r) => r.id),
        })),
        conversionDate,
      }).unwrap();
      setGroupTargets(new Map());
      setRowTargets(new Map());
      setOpen(new Set());
      toast.success("已改記到保管人名下");
    } catch (e) {
      toast.error(financeErrorText(e, "改不了，請再試一次"));
    }
  };

  if (items.length === 0)
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-neutral-500">收的錢都記在保管人名下</p>
        {reassigned.length > 0 && <Reassigned rows={reassigned} />}
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      {/* 預覽：手機在清單上方，電腦在右欄貼著 */}
      <aside
        aria-label="改記後"
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1"
      >
        <h4 className="text-sm font-medium text-neutral-900">改記後</h4>
        {moving.length === 0 ? (
          <p className="text-sm text-neutral-500">都選了先不改</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {[...byTarget].map(([to, rows]) => (
              <li key={to} className="flex flex-col">
                <span className="flex items-baseline justify-between gap-2 text-[15px] font-semibold text-neutral-900 tabular-nums">
                  <span className="truncate">{nameOf(to)}</span>
                  <span>+${formatMoney(sum(rows))}</span>
                </span>
                <span className="text-[13px] text-neutral-600">{breakdown(rows)}</span>
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <p className="flex items-baseline justify-between gap-2 text-[13px] text-neutral-600 tabular-nums">
            <span>先不改 {skipped.length} 筆</span>
            <span>${formatMoney(sum(skipped))}</span>
          </p>
        )}
        {moving.length > 0 && (
          <p className="flex items-baseline justify-between gap-2 border-t border-neutral-200 pt-2.5 text-sm text-neutral-900 tabular-nums">
            <span>共改記 {moving.length} 筆</span>
            <span className="font-semibold">${formatMoney(sum(moving))}</span>
          </p>
        )}
        <Button disabled={isLoading || moving.length === 0} onClick={submit} className="w-full">
          確認改記{moving.length > 0 ? ` ${moving.length} 筆` : ""}
        </Button>
      </aside>

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        {[...groups].map(([receiverUserId, rows]) => {
          const expanded = open.has(receiverUserId);
          const overrides = rows.filter((r) => rowTargets.has(rowKey(r))).length;
          const listId = `stray-${receiverUserId}`;
          return (
            <section key={receiverUserId} className="flex flex-col rounded-xl border border-neutral-200">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <h4 className="min-w-0 flex-1 text-sm font-medium text-neutral-900 tabular-nums">
                  {rows[0].receiverName} 收的 · {rows.length} 筆 ${formatMoney(sum(rows))}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[13px] text-neutral-600">全部改給</span>
                  <div className="w-32">
                    <Select
                      size="sm"
                      aria-label={`${rows[0].receiverName} 收的全部改給誰`}
                      value={groupTargetOf(receiverUserId)}
                      onChange={(v) => setGroup(receiverUserId, rows, v)}
                      options={targetOptions}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => toggle(receiverUserId)}
                className="flex min-h-11 items-center gap-1.5 border-t border-neutral-100 px-3 text-left text-[13px] text-neutral-600 hover:bg-neutral-50"
              >
                <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
                {expanded ? "收起" : `展開 ${rows.length} 筆`}
                {overrides > 0 && <span className="text-neutral-500">· {overrides} 筆個別設定</span>}
              </button>
              {expanded && (
                <ul id={listId} className="flex flex-col divide-y divide-neutral-100 border-t border-neutral-100 px-3">
                  {rows.map((i) => {
                    const own = rowTargets.has(rowKey(i));
                    return (
                      <li key={rowKey(i)} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-neutral-900">
                              {shortDate(i.date)} · {i.studentName}
                            </span>
                            {own && <StatusTag tone="outline">個別設定</StatusTag>}
                          </span>
                          <span className="truncate text-[13px] text-neutral-600">
                            {what(i)} · ${formatMoney(i.amount)}
                            {i.collectedByName && i.collectedByName !== i.receiverName
                              ? ` · 原本 ${i.collectedByName} 收`
                              : ""}
                          </span>
                        </span>
                        <div className="w-28 shrink-0">
                          <Select
                            size="sm"
                            aria-label={`${i.studentName} 改給誰`}
                            value={targetOf(i)}
                            onChange={(v) => setRow(i, v)}
                            options={targetOptions}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {reassigned.length > 0 && (
        <div className="lg:col-start-1">
          <Reassigned rows={reassigned} />
        </div>
      )}
    </div>
  );
}

/** 「vv 5 筆、Nora 1 筆」 */
function breakdown(rows: StrayReceiverItem[]) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.receiverName, (counts.get(r.receiverName) ?? 0) + 1);
  return [...counts].map(([name, n]) => `${name} ${n} 筆`).join("、");
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
