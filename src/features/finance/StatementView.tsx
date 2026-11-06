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
import { monthWaterfall } from "@/domains/finance/waterfall";
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
  useReviewBranchMutation,
} from "@/store/slices/finance";
import type { MonthStatement } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { cn } from "@/lib/utils";
import CustodyCard, { formatSigned } from "./CustodyCard";
import { custodyRows } from "./custodyRows";
import type { NameMaps } from "./custodyRows";
import { fundDeficits } from "./custodyNotices";
import { financeErrorText, isPayoutDone, matchingTransfers, monthLabel, todayKey, transferTargetName } from "./financeUi";
import { useSplitNames } from "./useSplitNames";
import { WaterfallRows } from "./MonthWaterfall";

const shortDate = (iso: string) => toTaipeiDateKey(new Date(iso)).slice(5).replace("-", "/");

type Review = MonthStatement["reviews"][number];
type StatementPeriod = MonthStatement["periods"][number];

/** 舊的鎖住結算單沒有 fundLocationId → 用上課分部。 */
const fundOf = (p: StatementPeriod) => (p.fundLocationId === undefined ? p.locationId : p.fundLocationId);

const reviewText = (r: Review) => (r.valid ? "已核對" : r.reviewedById !== null ? "核對後有變動" : "還沒核對");

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

/** 月結算單（spec §7.4）。鎖住前是即時預覽；鎖住後每筆要轉的錢顯示「等待轉帳／已完成轉帳」，付款人轉完自己按。 */
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
  const { data: me } = useGetMeQuery();
  const [lock, { isLoading: locking }] = useLockMonthMutation();
  const [review, { isLoading: reviewing }] = useReviewBranchMutation();
  const [reviewingId, setReviewingId] = useState<number | null>(null);
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
  const venueName = (id: number) => (venues?.venues ?? []).find((v) => v.id === id)?.name ?? "場地";
  /** 這個月這位保管人轉出的錢（付清的待付列會消失，卡片下面留下痕跡）。 */
  const monthTransfersOf = (userId: number) =>
    transfers
      .filter((t) => t.fromUserId === userId && monthOf(new Date(t.date)) === month)
      .map((t) => ({
        key: String(t.id),
        amount: t.amount,
        text: `${userName(t.fromUserId)} → ${transferTargetName(t, { user: userName, teacher: names.teacher, venue: venueName })} · ${shortDate(t.date)}`,
      }));

  const markReviewed = async (locationId: number) => {
    setReviewingId(locationId);
    try {
      await review({ month, locationId }).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "核對沒記下來，請再試一次"));
    }
    setReviewingId(null);
  };

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
        `${financeErrorText(e, "取消失敗")}${removed > 0 ? `（已取消 ${removed} 筆，還有 ${list.length - removed} 筆沒取消，這一列可能還顯示已完成轉帳）` : ""}`,
      );
    }
    setBusyKey(null);
  };

  // 舊的鎖住結算單沒有這些欄位
  const expiryAdjustments = statement.expiryAdjustments ?? [];
  const reviews = statement.reviews ?? [];
  // 我的排第一
  const holderIds = Object.keys(statement.custodyBefore)
    .map(Number)
    .sort((a, b) => Number(b === me?.id) - Number(a === me?.id));
  const unreviewed = reviews.filter((r) => !r.valid);

  // 各分部（依這堂課的基金）：有負責人的分部，加上這個月有營收或支出、但沒有負責人的
  const fundOfPeriod = new Map(statement.periods.map((p) => [p.periodId, fundOf(p)]));
  const sections: { locationId: number | null; name: string; review: Review | null }[] = [
    ...reviews.map((r) => ({ locationId: r.locationId, name: r.name, review: r })),
    ...statement.byBranch
      .filter((b) => !reviews.some((r) => r.locationId === b.locationId))
      .map((b) => ({ locationId: b.locationId, name: b.name, review: null })),
  ];
  const branchNotes = (locationId: number | null) => {
    const pending = statement.pending.filter((n) => (fundOfPeriod.get(n.periodId) ?? null) === locationId);
    return {
      unpaid: pending.filter((n) => n.kind === "unpaid"),
      undecided: pending.filter((n) => n.kind === "undecided"),
      unchecked: statement.uncheckedByBranch?.find((u) => u.locationId === locationId)?.count ?? 0,
    };
  };
  // 舊的鎖住結算單沒有分部別的「還沒點名」：整間教室一起提醒
  const legacyUnchecked = statement.uncheckedByBranch ? 0 : statement.uncheckedPeriods;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-neutral-900">{monthLabel(month)}結算單</h1>
        <StatusTag tone={locked ? "positive" : "warning"}>{locked ? "已結算" : "未結算"}</StatusTag>
      </header>

      <section
        aria-label="結算狀態"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5"
      >
        {reviews.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {reviews.map((r) => (
              <li key={r.locationId} className="flex items-center gap-1.5">
                <span className="font-medium text-neutral-900">{r.name}</span>
                <StatusTag tone={r.valid ? "positive" : "warning"}>{reviewText(r)}</StatusTag>
              </li>
            ))}
            <li className="flex items-center">
              <InfoTip label="核對說明">
                分部負責人確認「該收的都收到、數字對」就按核對。核對不擋結算；核對之後這個分部的資料有變動，核對會自動取消。
              </InfoTip>
            </li>
          </ul>
        ) : (
          <span className="text-sm text-neutral-600">{locked ? "這個月已經結算" : "這個月還沒結算"}</span>
        )}
        {!locked && canEdit && (
          <div className="flex flex-col items-end gap-1">
            <Button disabled={!!blocker} onClick={() => setConfirming(true)}>
              確認結算
            </Button>
            {blocker && <p className="max-w-xs text-right text-[13px] text-neutral-500">{blocker}</p>}
          </div>
        )}
      </section>

      {statement.warnings.includes("UNALLOCATED") && (
        <p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-950">
          有一些錢還沒分給誰（有課沒設分帳規則，或分部沒有保管人）。
        </p>
      )}

      {holderIds.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {holderIds.map((userId) => {
            const payouts = statement.payouts.filter((p) => p.fromUserId === userId);
            return (
              <section key={userId} className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
                <h2 className="mb-1 text-base font-semibold text-neutral-900">
                  {userId === me?.id ? "我" : userName(userId)}要轉／領
                </h2>
                {payouts.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-500">沒有要轉的</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {payouts.map((p) => {
                      const key = payoutKey(p);
                      const done = locked && isPayoutDone(p, transfers, month);
                      const busy = busyKey === key && (creating || undoing);
                      // 付款人自己按，或可以結算的人代按；付款人只能取消自己按的，可以結算的人都能取消
                      const canMark = canEdit || p.fromUserId === me?.id;
                      const matched = matchingTransfers(p, transfers, month);
                      const last = matched.at(-1);
                      const canUndo =
                        canEdit || (p.fromUserId === me?.id && matched.length > 0 && matched.every((t) => t.createdById === me?.id));
                      return (
                        <li key={key} className="flex flex-col gap-1.5 py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 text-neutral-800">{payoutText(p)}</span>
                            <span className="shrink-0 font-medium tabular-nums">${formatMoney(p.amount)}</span>
                          </div>
                          {locked && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <StatusTag tone={done ? "positive" : "warning"}>{done ? "已完成轉帳" : "等待轉帳"}</StatusTag>
                                {done && last && (
                                  <span className="truncate text-[13px] text-neutral-500">
                                    {userName(last.createdById)} {shortDate(last.createdAt)} 按
                                  </span>
                                )}
                              </span>
                              {done
                                ? canUndo && (
                                    <Button size="sm" variant="ghost" isLoading={busy} onClick={() => undo(p)}>
                                      取消
                                    </Button>
                                  )
                                : canMark && (
                                    <Button size="sm" variant="secondary" isLoading={busy} onClick={() => markDone(p)}>
                                      已完成
                                    </Button>
                                  )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {payouts.length > 0 && (
                  <p className="mt-2 text-[13px] text-neutral-500">{locked ? "" : "確認結算之後，"}轉完錢按那一筆的「已完成」，系統就會記下這筆轉帳，不用再去「記轉帳」。</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {legacyUnchecked > 0 && (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">還有 {legacyUnchecked} 堂還沒點名。</p>
      )}

      {sections.length === 0 ? (
        <Block title="各分部">
          <EmptyState kind="inline" title="這個月沒有營收或支出" />
        </Block>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map(({ locationId, name, review: r }) => {
            const notes = branchNotes(locationId);
            const hasNotes = notes.unpaid.length > 0 || notes.undecided.length > 0 || notes.unchecked > 0;
            const periods = statement.periods.filter((p) => fundOf(p) === locationId);
            const branch = statement.byBranch.find((b) => b.locationId === locationId);
            return (
              <section
                key={locationId ?? "none"}
                aria-label={name}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                    {name}
                    {r && <StatusTag tone={r.valid ? "positive" : "warning"}>{reviewText(r)}</StatusTag>}
                  </h2>
                  {r && !r.valid && r.keeperUserId === me?.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={reviewing && reviewingId === r.locationId}
                      onClick={() => markReviewed(r.locationId)}
                    >
                      核對
                    </Button>
                  )}
                </div>
                {locationId !== null ? (
                  <WaterfallRows w={monthWaterfall(statement, locationId)} fundName={locationNames[locationId]} />
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    <Line label="營收" value={`$${formatMoney(branch?.revenue ?? 0)}`} />
                    <Line label="支出" value={`$${formatMoney(branch?.expenses ?? 0)}`} />
                    <Line label="公積金變化" value={formatSigned(branch?.fundChange ?? 0)} strong />
                  </ul>
                )}
                {hasNotes && (
                  <div className="border-t border-neutral-100 pt-3">
                    <h3 className="flex items-center gap-1 text-sm font-medium text-neutral-900">
                      還沒算進來的
                      <InfoTip label="還沒算進來的說明">
                        只提醒，不擋結算。補上之後如果月份已經結算，會變成下個月的調整。
                      </InfoTip>
                    </h3>
                    <ul className="divide-y divide-neutral-100">
                      {notes.unpaid.map((n, i) => (
                        <Line key={`u${i}`} label={`待收 · ${n.studentName}`} value={`$${formatMoney(n.amount ?? 0)}`} />
                      ))}
                      {notes.undecided.map((n, i) => (
                        <Line key={`d${i}`} label={`待定 · ${n.studentName}`} value="還沒決定用哪張卡" />
                      ))}
                      {notes.unchecked > 0 && <Line label="還沒點名的時段" value={`${notes.unchecked} 堂`} />}
                    </ul>
                  </div>
                )}
                {periods.length > 0 && (
                  <details className="border-t border-neutral-100 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-neutral-900">
                      每堂明細（{periods.length} 堂）
                    </summary>
                    <ul className="mt-2 divide-y divide-neutral-100">
                      {periods.map((p) => (
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
              </section>
            );
          })}
        </div>
      )}

      <Block
        title="每個人這個月"
        tip="各堂分潤加上調整，就是這個月每個人該領的錢。發錢時各人的合計會取整數，零頭進付款人負責分部的公積金。"
      >
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
      </Block>

      {holderIds.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
          <h2 className="flex items-center gap-1 text-base font-semibold text-neutral-900">
            保管中
            <span className="text-[13px] font-normal text-neutral-500">{locked ? "月結前 → 轉完之後" : "月結前"}</span>
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {holderIds.map((userId) => {
                const buckets = statement.custodyBefore[userId];
                const self = userName(userId);
                return (
                  <CustodyCard
                    key={userId}
                    name={`${self}（月結前）`}
                    total={buckets.cash}
                    rows={custodyRows(buckets, nameMaps(self))}
                    deficits={fundDeficits(buckets, locationNames)}
                    transfers={locked ? [] : monthTransfersOf(userId)}
                  />
                );
              })}
            </div>
            {locked && custody && (
              <section className="flex flex-col gap-3">
                <h3 className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
                  轉完之後
                  <InfoTip label="轉完之後說明">
                    這是現在的保管中。每筆都按了「已完成」之後，只會剩預收、公積金和場地包。
                  </InfoTip>
                </h3>
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {custody.users.map((u) => (
                    <CustodyCard
                      key={u.userId}
                      name={u.name}
                      total={u.buckets.cash}
                      rows={custodyRows(u.buckets, nameMaps(u.name))}
                      deficits={fundDeficits(u.buckets, locationNames)}
                      transfers={monthTransfersOf(u.userId)}
                    />
                  ))}
                </div>
              </section>
            )}
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
        message={`${
          unreviewed.length > 0 ? `${unreviewed.map((r) => r.name).join("、")}還沒核對（不擋結算）。` : ""
        }確認後這個月就鎖住，結算單不會再變；之後補的點名、收款會變成下個月的調整。確定要結算嗎？`}
        confirmLabel="確認結算"
        isLoading={locking}
        onConfirm={confirmLock}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
