"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { monthOf } from "@/domains/finance/months";
import {
  useGetCustodyQuery,
  useGetFinanceSettingsQuery,
  useGetFinancePacksQuery,
  useGetFinanceVenuesQuery,
  useGetSettlementMonthsQuery,
} from "@/store/slices/finance";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { fundDeficits, unsettledNotice, warningsNotice } from "./custodyNotices";
import CustodyCard from "./CustodyCard";
import { custodyRows } from "./custodyRows";
import type { NameMaps } from "./custodyRows";

/** `banner`: 上方的提醒位置（開帳清單，Task 17 放進來）。 */
export default function FinanceHome({ banner }: { banner?: ReactNode }) {
  const { data: settings, isLoading: settingsLoading } = useGetFinanceSettingsQuery();
  const enabled = !!settings?.enabled;
  const { data: custody, isLoading: custodyLoading, isError } = useGetCustodyQuery(undefined, { skip: !enabled });
  const { data: months } = useGetSettlementMonthsQuery(undefined, { skip: !enabled });
  const { data: teachers } = useGetTeachersQuery(undefined, { skip: !enabled });
  const { data: locations } = useGetLocationsQuery(undefined, { skip: !enabled });
  const { data: packs } = useGetFinancePacksQuery(undefined, { skip: !enabled });
  const { data: venues } = useGetFinanceVenuesQuery(undefined, { skip: !enabled });

  if (settingsLoading || (enabled && custodyLoading)) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }
  if (!enabled) {
    return <EmptyState kind="page" title="這間教室還沒開財務" />;
  }
  if (isError || !custody) {
    return <EmptyState kind="inline" title="讀不到財務資料，請稍後再試" />;
  }

  const base = {
    teachers: Object.fromEntries((teachers ?? []).map((t) => [t.id, t.name])),
    locations: Object.fromEntries((locations?.locations ?? []).map((l) => [l.id, l.name])),
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
    users: Object.fromEntries(custody.users.map((u) => [u.userId, u.name])),
  };

  const currentMonth = monthOf(new Date());
  const unsettled = unsettledNotice(months?.openMonth, currentMonth);
  const warning = warningsNotice(custody.warnings);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {banner}
      {unsettled && (
        <p className="rounded-xl bg-warning-100 px-4 py-3 text-sm font-medium text-warning-950">
          {unsettled}
        </p>
      )}
      {warning && <p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-950">{warning}</p>}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {custody.users.map((u) => {
          const names: NameMaps = { ...base, self: u.name };
          const deficits = fundDeficits(u.buckets, base.locations);
          return (
            <CustodyCard
              key={u.userId}
              name={u.name}
              total={u.buckets.cash}
              rows={custodyRows(u.buckets, names)}
              deficits={deficits}
            />
          );
        })}
      </div>
    </div>
  );
}
