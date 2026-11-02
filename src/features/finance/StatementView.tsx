"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { monthOf } from "@/domains/finance/months";
import { formatMoney } from "@/lib/money";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import type { Payout } from "@/service/finance/settlement";
import {
  useCreateTransferMutation,
  useDeleteTransferMutation,
  useGetCustodyQuery,
  useGetFinanceSettingsQuery,
  useGetFinancePacksQuery,
  useGetFinanceTransfersQuery,
  useGetFinanceVenuesQuery,
  useGetMonthStatementQuery,
  useGetSettlementMonthsQuery,
  useLockMonthMutation,
} from "@/store/slices/finance";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { cn } from "@/lib/utils";
import CustodyCard, { formatSigned } from "./CustodyCard";
import { custodyRows } from "./custodyRows";
import type { NameMaps } from "./custodyRows";
import { fundDeficits } from "./custodyNotices";
import { financeErrorText, isPayoutDone, matchingTransfers, monthLabel, todayKey } from "./financeUi";
import { useSplitNames } from "./useSplitNames";

const shortDate = (iso: string) => toTaipeiDateKey(new Date(iso)).slice(5).replace("-", "/");

function Block({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <h2 className="mb-2 flex items-center gap-1 text-base font-semibold text-neutral-900">
        {title}
        {tip && <InfoTip label={`${title}說明`}>{tip}</InfoTip>}
      </h2>
      {children}
    </section>
  );
}

const Line = ({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) => (
  <li className="flex items-center justify-between gap-3 py-2 text-sm">
    <span className="min-w-0 text-neutral-700">{label}</span>
    <span className={cn("shrink-0 tabular-nums text-neutral-900", strong && "font-semibold")}>{value}</span>
  </li>
);

/** 月結算單（spec §7.4）。鎖住前是即時預覽；鎖住後每筆要轉的錢有「已轉」。 */
export default function StatementView({ month }: { month: string }) {
  const names = useSplitNames();
  const { data: settings } = useGetFinanceSettingsQuery();
  const enabled = !!settings?.enabled;
  const { data: statement, isLoading, isError } = useGetMonthStatementQuery(month, { skip: !enabled });
  const { data: months } = useGetSettlementMonthsQuery(undefined, { skip: !enabled });
  const { data: transferData } = useGetFinanceTransfersQuery(undefined, { skip: !enabled });
  const { data: custody } = useGetCustodyQuery(undefined, { skip: !enabled });
  const { data: teachers } = useGetTeachersQuery(undefined, { skip: !enabled });
  const { data: locationData } = useGetLocationsQuery(undefined, { skip: !enabled });
  const { data: packs } = useGetFinancePacksQuery(undefined, { skip: !enabled });
  const { data: venues } = useGetFinanceVenuesQuery(undefined, { skip: !enabled });
  const [lock, { isLoading: locking }] = useLockMonthMutation();
  const [createTransfer, { isLoading: creating }] = useCreateTransferMutation();
  const [deleteTransfer, { isLoading: undoing }] = useDeleteTransferMutation();
  const [confirming, setConfirming] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!settings || (enabled && isLoading)) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (!enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;
  if (isError || !statement) return <EmptyState kind="inline" title="讀不到這個月的結算單，請稍後再試" />;

  const userName = (id: number) => settings.members.find((m) => m.userId === id)?.name ?? "成員";
  const locked = statement.locked;
  const transfers = transferData?.transfers ?? [];
  const canEdit = names.canEdit;

  // 能不能按「確認結算」
  const ended = monthOf(new Date()) > month;
  const isOpen = months?.openMonth === month;
  const blocker = locked || !months
    ? null
    : !isOpen
      ? `要先結算 ${months.openMonth}`
      : !ended
        ? "這個月還沒結束，月底過後才能確認結算"
        : statement.warnings.includes("UNALLOCATED")
          ? "還有錢不知道要給誰（有課沒有分帳規則），要先補上才能結算"
          : null;

  const nameMaps = (self: string): NameMaps => ({
    self,
    teachers: Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name])),
    locations: Object.fromEntries((locationData?.locations ?? []).map((l) => [l.id, l.name])),
    venues: Object.fromEntries((venues?.venues ?? []).map((v) => [v.id, v.name])),
    packs: Object.fromEntries(
      (packs?.packs ?? []).map((p) => [
        p.id,
        {
          venue: (venues?.venues ?? []).find((v) => v.id === p.venueId)?.name ?? "",
          unitValue: p.sessions > 0 ? p.price / p.sessions : 0,
        },
      ]),
    ),
    users: Object.fromEntries(settings.members.map((m) => [m.userId, m.name])),
  });
  const locationNames = nameMaps("").locations;

  const confirmLock = async () => {
    try {
      await lock(month).unwrap();
      toast.success(`${monthLabel(month)}已確認結算`);
    } catch (e) {
      toast.error(financeErrorText(e, "結算失敗，請再試一次"));
    }
    setConfirming(false);
  };

  const payoutText = (p: Payout) => {
    const from = userName(p.fromUserId);
    if (p.toKind === "SELF") return `${from} 領走自己的`;
    if (p.toKind === "USER") return `${from} → ${userName(p.toUserId ?? 0)}`;
    if (p.toKind === "TEACHER") return `${from} → ${names.teacher(p.toTeacherId ?? 0)}`;
    return `${from} → ${names.venue(p.toVenueId ?? 0)}`;
  };
  const payoutKey = (p: Payout) => `${p.fromUserId}:${p.toKind}:${p.toUserId ?? ""}:${p.toTeacherId ?? ""}:${p.toVenueId ?? ""}`;

  const markDone = async (p: Payout) => {
    setBusyKey(payoutKey(p));
    try {
      await createTransfer({
        date: todayKey(),
        amount: p.amount - matchingTransfers(p, transfers, month).reduce((sum, t) => sum + t.amount, 0),
        fromUserId: p.fromUserId,
        toKind: p.toKind,
        ...(p.toUserId !== undefined && p.toKind !== "SELF" ? { toUserId: p.toUserId } : {}),
        ...(p.toTeacherId !== undefined ? { toTeacherId: p.toTeacherId } : {}),
        ...(p.toVenueId !== undefined ? { toVenueId: p.toVenueId } : {}),
        settlementMonth: month,
      }).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "記不下來，請再試一次"));
    }
    setBusyKey(null);
  };
  const undo = async (p: Payout) => {
    setBusyKey(payoutKey(p));
    const list = matchingTransfers(p, transfers, month);
    let removed = 0;
    try {
      for (const t of list) {
        await deleteTransfer(t.id).unwrap();
        removed++;
      }
    } catch (e) {
      toast.error(
        `${financeErrorText(e, "取消失敗")}${removed > 0 ? `（已取消 ${removed} 筆，還有 ${list.length - removed} 筆沒取消，這一列可能還顯示已轉）` : ""}`,
      );
    }
    setBusyKey(null);
  };

  // 舊的鎖住結算單沒有這個欄位
  const expiryAdjustments = statement.expiryAdjustments ?? [];
  const holderIds = Object.keys(statement.custodyBefore).map(Number);
  const pendingUnpaid = statement.pending.filter((n) => n.kind === "unpaid");
  const pendingUndecided = statement.pending.filter((n) => n.kind === "undecided");
  const hasNotes = pendingUnpaid.length > 0 || pendingUndecided.length > 0 || statement.uncheckedPeriods > 0;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-neutral-900">{monthLabel(month)}結算單</h1>
          <StatusTag tone={locked ? "positive" : "warning"}>{locked ? "已結算" : "未結算"}</StatusTag>
        </div>
        {!locked && canEdit && (
          <div className="flex flex-col items-end gap-1">
            <Button disabled={!!blocker} onClick={() => setConfirming(true)}>
              確認結算
            </Button>
            {blocker && <p className="max-w-xs text-right text-[13px] text-neutral-500">{blocker}</p>}
          </div>
        )}
      </header>

      {statement.warnings.includes("UNALLOCATED") && (
        <p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-950">
          有一些錢還沒分給誰（有課沒設分帳規則，或分部沒有保管人）。
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="每個人這個月" tip="各堂分潤加上調整，就是這個月每個人該領的錢。發錢時各人的合計會取整數，零頭進付款人負責分部的公積金。">
          {statement.byPerson.length === 0 ? (
            <EmptyState kind="inline" title="這個月沒有人要領錢" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {statement.byPerson.map((p) => (
                <Line
                  key={p.teacherId}
                  label={
                    <>
                      {p.name}
                      {p.payerUserId !== null && (
                        <span className="ml-1.5 text-[13px] text-neutral-500">{userName(p.payerUserId)}付</span>
                      )}
                    </>
                  }
                  value={`$${formatMoney(p.rounded)}`}
                  strong
                />
              ))}
            </ul>
          )}
          {(statement.adjustments.length > 0 || expiryAdjustments.length > 0) && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <h3 className="mb-1 text-sm font-medium text-neutral-900">調整（結算後才補的）</h3>
              <ul className="divide-y divide-neutral-100">
                {expiryAdjustments.map((a) => (
                  <li key={`x${a.studentCardId}`} className="py-2 text-sm">
                    <div className="text-neutral-800">過期收入 · 課卡 {a.serial}</div>
                    <div className="text-[13px] text-neutral-500">
                      {a.deltas.map((d, i) => (
                        <span key={i} className="mr-3">
                          {d.to.type === "fund" ? `${locationNames[d.to.locationId] ?? "分部"}公積金` : userName(d.to.userId)}{" "}
                          {d.amount >= 0 ? "+" : "−"}${formatMoney(Math.abs(d.amount))}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
                {statement.adjustments.map((a) => (
                  <li key={a.periodId} className="py-2 text-sm">
                    <div className="text-neutral-800">
                      {shortDate(a.date)} {a.lessonName}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {a.deltas.map((d, i) => (
                        <span key={i} className="mr-3">
                          {names.payee(d.payee)} {d.amount >= 0 ? "+" : "−"}${formatMoney(Math.abs(d.amount))}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {statement.periods.length > 0 && (
            <details className="mt-3 border-t border-neutral-100 pt-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-900">各堂明細（{statement.periods.length} 堂）</summary>
              <ul className="mt-2 divide-y divide-neutral-100">
                {statement.periods.map((p) => (
                  <li key={p.periodId} className="py-2 text-sm">
                    <div className="flex justify-between gap-3 text-neutral-800">
                      <span className="min-w-0 truncate">
                        {shortDate(p.startTime)} {p.lessonName}
                      </span>
                      <span className="shrink-0 tabular-nums">${formatMoney(p.income.total)}</span>
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {p.allocations === null
                        ? "還沒有分帳規則"
                        : p.allocations.map((a, i) => (
                            <span key={i} className="mr-3">
                              {names.payee(a.payee)} ${formatMoney(a.amount)}
                            </span>
                          ))}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Block>

        <div className="flex flex-col gap-4">
          <Block title="各分部" tip="營收是這個月上課的已付款收入；公積金變化 = 分到公積金的錢（含過期收入）− 支出。">
            {statement.byBranch.length === 0 ? (
              <EmptyState kind="inline" title="這個月沒有營收或支出" />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {statement.byBranch.map((b) => (
                  <li key={b.locationId ?? "none"} className="py-2.5 text-sm">
                    <div className="font-medium text-neutral-900">{b.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-neutral-600">
                      <span>營收 ${formatMoney(b.revenue)}</span>
                      <span>支出 ${formatMoney(b.expenses)}</span>
                      <span>公積金 {b.fundChange >= 0 ? "+" : ""}{formatSigned(b.fundChange)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          {hasNotes && (
            <Block title="還沒算進來的" tip="只提醒，不擋結算。補上之後如果月份已經結算，會變成下個月的調整。">
              <ul className="divide-y divide-neutral-100">
                {pendingUnpaid.map((n, i) => (
                  <Line key={`u${i}`} label={`待收 · ${n.studentName}`} value={`$${formatMoney(n.amount ?? 0)}`} />
                ))}
                {pendingUndecided.map((n, i) => (
                  <Line key={`d${i}`} label={`待定 · ${n.studentName}`} value="還沒決定用哪張卡" />
                ))}
                {statement.uncheckedPeriods > 0 && <Line label="還沒點名的時段" value={`${statement.uncheckedPeriods} 堂`} />}
              </ul>
            </Block>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {holderIds.map((userId) => {
          const buckets = statement.custodyBefore[userId];
          const payouts = statement.payouts.filter((p) => p.fromUserId === userId);
          const self = userName(userId);
          return (
            <div key={userId} className="flex flex-col gap-3">
              <CustodyCard
                name={`${self}（月結前）`}
                total={buckets.cash}
                rows={custodyRows(buckets, nameMaps(self))}
                deficits={fundDeficits(buckets, locationNames)}
              />
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
                <h3 className="mb-1 text-sm font-semibold text-neutral-900">{self}要轉／領</h3>
                {payouts.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-500">沒有要轉的</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {payouts.map((p) => {
                      const key = payoutKey(p);
                      const done = locked && isPayoutDone(p, transfers, month);
                      const busy = busyKey === key && (creating || undoing);
                      return (
                        <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 text-neutral-800">{payoutText(p)}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-medium tabular-nums">${formatMoney(p.amount)}</span>
                            {locked &&
                              (done ? (
                                <>
                                  <StatusTag tone="positive">已轉</StatusTag>
                                  {canEdit && (
                                    <Button size="sm" variant="ghost" isLoading={busy} onClick={() => undo(p)}>
                                      取消
                                    </Button>
                                  )}
                                </>
                              ) : (
                                canEdit && (
                                  <Button size="sm" variant="secondary" isLoading={busy} onClick={() => markDone(p)}>
                                    已轉
                                  </Button>
                                )
                              ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!locked && payouts.length > 0 && (
                  <p className="mt-2 text-[13px] text-neutral-500">確認結算之後，才能按「已轉」。</p>
                )}
              </section>
            </div>
          );
        })}
      </div>

      {locked && custody && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1 text-base font-semibold text-neutral-900">
            轉完之後
            <InfoTip label="轉完之後說明">
              這是現在的保管中。每筆都按了「已轉」之後，只會剩預收、公積金和場地包。
            </InfoTip>
          </h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {custody.users.map((u) => (
              <CustodyCard
                key={u.userId}
                name={u.name}
                total={u.buckets.cash}
                rows={custodyRows(u.buckets, nameMaps(u.name))}
                deficits={fundDeficits(u.buckets, locationNames)}
              />
            ))}
          </div>
        </section>
      )}

      <p className="text-[13px] text-neutral-500">
        <Link href="/finance" className="underline underline-offset-4">
          回財務首頁
        </Link>
      </p>

      <ConfirmDialog
        open={confirming}
        title={`確認結算 ${monthLabel(month)}`}
        message="確認後這個月就鎖住，結算單不會再變；之後補的點名、收款會變成下個月的調整。確定要結算嗎？"
        confirmLabel="確認結算"
        isLoading={locking}
        onConfirm={confirmLock}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
