"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import Field, { FieldLabel } from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import {
  useCreatePackMutation,
  useCreateVenueMutation,
  useDeleteVenueMutation,
  useGetFinancePacksQuery,
  useGetFinanceSettingsQuery,
  useGetFinanceVenuesQuery,
  useUpdateFinanceLocationMutation,
  useUpdateVenueMutation,
  useVoidPackMutation,
  type FinanceLocation,
  type FinanceSettings as Settings,
  type FinanceVenue,
} from "@/store/slices/finance";
import { activePacks, packCapacity, sessionsLeft } from "./venueBilling";
import { dateLabel, financeErrorText, todayKey } from "./financeUi";

/** 財務設定：分部負責人與轉換日（管理員）、場地與次數包（管理員＋負責人）。 */
export default function FinanceSettings() {
  const { data: settings } = useGetFinanceSettingsQuery();
  if (!settings) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="iconSm" aria-label="回財務" asChild>
          <Link href="/finance">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-neutral-900 lg:text-2xl">財務設定</h1>
      </div>
      <Branches settings={settings} />
      <Venues settings={settings} />
    </div>
  );
}

function Branches({ settings }: { settings: Settings }) {
  const active = settings.locations.filter((l) => !l.archivedAt);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1 text-base font-bold text-neutral-900">
        分部
        <InfoTip label="分部說明">
          負責人＝這個分部的錢在他手上，當天付老師、場地的預設也是他。轉換日＝從這天起，這個分部的課和到期的卡才算錢；沒設就不算。
        </InfoTip>
      </h2>
      {active.length === 0 ? (
        <EmptyState kind="inline" title="還沒有分部" description="先到教室設定新增分部" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {active.map((l) => (
            <BranchRow key={l.id} location={l} settings={settings} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BranchRow({ location: l, settings }: { location: FinanceLocation; settings: Settings }) {
  const [update, { isLoading }] = useUpdateFinanceLocationMutation();
  const [keeper, setKeeper] = useState<number | null>(l.keeperUserId);
  const [start, setStart] = useState(l.financeStartAt ? toTaipeiDateKey(new Date(l.financeStartAt)) : "");
  const dirty = keeper !== l.keeperUserId || start !== (l.financeStartAt ? toTaipeiDateKey(new Date(l.financeStartAt)) : "");
  const disabled = !settings.isAdmin;

  return (
    <li className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-end">
      <div className="flex items-center gap-2 lg:w-32 lg:pb-3">
        <span className="text-[15px] font-semibold text-neutral-900">{l.name}</span>
        {!l.financeStartAt && <StatusTag tone="neutral">沒算錢</StatusTag>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <FieldLabel>負責人</FieldLabel>
        <Select
          aria-label={`${l.name}負責人`}
          disabled={disabled}
          value={keeper ?? undefined}
          placeholder="還沒設"
          options={settings.members.map((m) => ({ value: m.userId, label: m.name }))}
          onChange={setKeeper}
        />
      </div>
      <Field
        className="flex-1"
        label="轉換日"
        type="date"
        disabled={disabled}
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      {!disabled && (
        <Button
          size="md"
          disabled={!dirty}
          isLoading={isLoading}
          onClick={async () => {
            try {
              await update({ id: l.id, keeperUserId: keeper, financeStartDate: start || null }).unwrap();
              toast.success(`${l.name}已更新`);
            } catch (e) {
              toast.error(financeErrorText(e));
            }
          }}
        >
          儲存
        </Button>
      )}
    </li>
  );
}

function Venues({ settings }: { settings: Settings }) {
  const { data: venueData } = useGetFinanceVenuesQuery();
  const { data: packData } = useGetFinancePacksQuery();
  const [editing, setEditing] = useState<FinanceVenue | "new" | null>(null);
  const [packFor, setPackFor] = useState<FinanceVenue | null>(null);
  const venues = (venueData?.venues ?? []).filter((v) => !v.archivedAt);
  const packs = packData?.packs ?? [];
  const locName = (id: number | null) => settings.locations.find((l) => l.id === id)?.name ?? "沒有分部";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1 text-base font-bold text-neutral-900">
          場地
          <InfoTip label="場地說明">
            場地屬於一個分部。收費方式二選一：每次付固定金額（當天付錢的人付），或先買次數包（買包的分部先付，之後每堂照單價分攤）。
          </InfoTip>
        </h2>
        {settings.canManage && (
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus />
            新增場地
          </Button>
        )}
      </div>
      {venues.length === 0 ? (
        <EmptyState kind="inline" title="還沒有場地" description="規則裡的「場地費」要先在這裡建場地" />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {venues.map((v) => (
            <li key={v.id} className="flex flex-col gap-2 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-neutral-900">{v.name}</span>
                <StatusTag tone="neutral">{locName(v.locationId)}</StatusTag>
                <span className="ml-auto text-sm text-neutral-700">
                  {v.perSessionPrice !== null
                    ? `每次 $${formatMoney(v.perSessionPrice)}`
                    : `次數包・剩 ${sessionsLeft(v.id, packs)} 次`}
                </span>
              </div>
              {v.perSessionPrice === null && (
                <ul className="flex flex-col gap-1 text-[13px] text-neutral-600">
                  {activePacks(v.id, packs).map((p) => (
                    <PackLine key={p.id} pack={p} canManage={settings.canManage} />
                  ))}
                </ul>
              )}
              {settings.canManage && (
                <div className="flex gap-3">
                  <Button variant="link" size="sm" onClick={() => setEditing(v)}>
                    編輯
                  </Button>
                  {v.perSessionPrice === null && (
                    <Button variant="link" size="sm" onClick={() => setPackFor(v)}>
                      買一包
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <VenueDrawer venue={editing === "new" ? null : editing} settings={settings} onClose={() => setEditing(null)} />}
      {packFor && <PackDrawer venue={packFor} onClose={() => setPackFor(null)} />}
    </section>
  );
}

function PackLine({
  pack: p,
  canManage,
}: {
  pack: { id: number; sessions: number; price: number; remainingAtStart: number | null; used: number; purchasedAt: string };
  canManage: boolean;
}) {
  const [voidPack, { isLoading }] = useVoidPackMutation();
  const cap = packCapacity(p);
  return (
    <li className="flex items-center gap-2">
      <span className="flex-1">
        {p.remainingAtStart !== null ? "轉換日前買的包" : dateLabel(p.purchasedAt)}・{p.sessions} 次 ${formatMoney(p.price)}
        （每次 ${formatMoney(Math.round(p.price / p.sessions))}）・用了 {p.used}/{cap}
      </span>
      {canManage && p.used === 0 && (
        <Button
          variant="link"
          size="sm"
          isLoading={isLoading}
          onClick={async () => {
            try {
              await voidPack(p.id).unwrap();
              toast.success("已作廢這包");
            } catch (e) {
              toast.error(financeErrorText(e));
            }
          }}
        >
          作廢
        </Button>
      )}
    </li>
  );
}

function VenueDrawer({ venue, settings, onClose }: { venue: FinanceVenue | null; settings: Settings; onClose: () => void }) {
  const active = settings.locations.filter((l) => !l.archivedAt);
  const [name, setName] = useState(venue?.name ?? "");
  const [locationId, setLocationId] = useState<number | null>(venue?.locationId ?? active[0]?.id ?? null);
  const [landlord, setLandlord] = useState<number | 0>(venue?.landlordUserId ?? 0);
  const [billing, setBilling] = useState<"perSession" | "pack">(venue && venue.perSessionPrice === null ? "pack" : "perSession");
  const [price, setPrice] = useState(venue?.perSessionPrice != null ? String(venue.perSessionPrice) : "");
  const [create, { isLoading: creating }] = useCreateVenueMutation();
  const [update, { isLoading: updating }] = useUpdateVenueMutation();
  const [remove, { isLoading: removing }] = useDeleteVenueMutation();
  const valid = name.trim() && locationId && (billing === "pack" || price !== "");

  const body = {
    name: name.trim(),
    locationId: locationId!,
    landlordUserId: landlord || null,
    perSessionPrice: billing === "pack" ? null : Number(price),
  };

  return (
    <Drawer
      open
      title={venue ? "編輯場地" : "新增場地"}
      onClose={onClose}
      isLoading={creating || updating}
      disabled={!valid}
      submitText="儲存"
      footerStart={
        venue && (
          <Button
            variant="link"
            size="sm"
            className="text-danger-700"
            isLoading={removing}
            onClick={async () => {
              try {
                await remove(venue.id).unwrap();
                toast.success("已刪除場地");
                onClose();
              } catch (e) {
                const code = (e as { data?: { code?: string } })?.data?.code;
                if (code === "VENUE_IN_USE") {
                  await update({ id: venue.id, archived: true });
                  toast.success("這個場地用過了，已改成封存");
                  onClose();
                } else toast.error(financeErrorText(e));
              }
            }}
          >
            刪除
          </Button>
        )
      }
      onSubmit={async () => {
        try {
          if (venue) await update({ id: venue.id, ...body }).unwrap();
          else await create(body).unwrap();
          toast.success("場地已儲存");
          onClose();
        } catch (e) {
          toast.error(financeErrorText(e));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label="名稱" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>分部</FieldLabel>
          <Select aria-label="分部" value={locationId ?? undefined} options={active.map((l) => ({ value: l.id, label: l.name }))} onChange={setLocationId} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel hint="（選填，是成員的話）">房東</FieldLabel>
          <Select
            aria-label="房東"
            value={landlord}
            options={[{ value: 0, label: "外部場地" }, ...settings.members.map((m) => ({ value: m.userId, label: m.name }))]}
            onChange={setLandlord}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>收費方式</FieldLabel>
          <SegmentedTabs
            ariaLabel="收費方式"
            fill
            value={billing}
            onChange={(v) => setBilling(v as "perSession" | "pack")}
            options={[
              { value: "perSession", label: "每次付" },
              { value: "pack", label: "次數包" },
            ]}
          />
        </div>
        {billing === "perSession" && (
          <Field label="每次多少" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        )}
      </div>
    </Drawer>
  );
}

function PackDrawer({ venue, onClose }: { venue: FinanceVenue; onClose: () => void }) {
  const [sessions, setSessions] = useState("10");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayKey());
  const [before, setBefore] = useState(false);
  const [remaining, setRemaining] = useState("");
  const [create, { isLoading }] = useCreatePackMutation();
  const valid = Number(sessions) > 0 && price !== "" && (!before || (remaining !== "" && Number(remaining) <= Number(sessions)));

  return (
    <Drawer
      open
      title="買一包"
      subtitle={venue.name}
      onClose={onClose}
      isLoading={isLoading}
      disabled={!valid}
      submitText="記下來"
      onSubmit={async () => {
        try {
          await create({
            venueId: venue.id,
            sessions: Number(sessions),
            price: Number(price),
            purchasedDate: date,
            remainingAtStart: before ? Number(remaining) : null,
          }).unwrap();
          toast.success("已記下次數包");
          onClose();
        } catch (e) {
          toast.error(financeErrorText(e));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <Field label="幾次" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value.replace(/[^\d]/g, ""))} />
        <Field label="整包多少錢" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        <Field label="買的日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-800">
          <input type="checkbox" className="size-4" checked={before} onChange={(e) => setBefore(e.target.checked)} />
          這包是轉換日前買的，現在還剩幾次
        </label>
        {before && (
          <Field label="還剩幾次" inputMode="numeric" value={remaining} onChange={(e) => setRemaining(e.target.value.replace(/[^\d]/g, ""))} />
        )}
      </div>
    </Drawer>
  );
}
