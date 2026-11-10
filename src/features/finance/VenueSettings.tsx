"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import MenuItem from "@/components/MenuItem";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney } from "@/lib/money";
import { useGetOpeningQuery } from "@/store/slices/ledger";
import {
  useCreateFinanceVenueMutation,
  useCreatePackMutation,
  useDeleteFinanceVenueMutation,
  useDeletePackMutation,
  useGetFinanceLocationsQuery,
  useGetFinancePacksQuery,
  useGetFinanceSettingsQuery,
  useGetFinanceVenuesQuery,
  useUpdateFinanceSettingsMutation,
  useUpdateFinanceVenueMutation,
  type FinanceLocation,
  type FinancePack,
  type FinanceVenue,
} from "@/store/slices/finance";
import PackForm from "./PackForm";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";
import { activePacks, beforePackValue, currentPack, packUnit, sessionsLeft } from "./venueBilling";

const NONE = 0;
const digits = (s: string) => s.replace(/\D/g, "");
const isWhole = (s: string, min: number) => s !== "" && Number.isInteger(Number(s)) && Number(s) >= min;
const money = (n: number) => `$${formatMoney(n)}`;

/** 開帳清單「場地」：這間教室不用場地費，勾了這一步就算完成。 */
export function NoVenueFeeToggle() {
  const { data: settings } = useGetFinanceSettingsQuery();
  const [update, { isLoading }] = useUpdateFinanceSettingsMutation();
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-900">
      <input
        type="checkbox"
        className="size-5 accent-primary-700"
        checked={!!settings?.noVenueFee}
        disabled={!settings || isLoading}
        onChange={async (e) => {
          try {
            await update({ noVenueFee: e.target.checked }).unwrap();
          } catch (err) {
            toast.error(financeErrorText(err, "存不了，請再試一次"));
          }
        }}
      />
      這間教室不用場地費
    </label>
  );
}

type Names = {
  member: (id: number | null) => string | null;
  location: (id: number | null) => FinanceLocation | undefined;
};

/** 「從 台南 負責人 丁丁 的錢付」；場地沒分部或分部沒負責人 → null。 */
function payerText(venue: FinanceVenue, n: Names): string | null {
  const loc = n.location(venue.locationId);
  const keeper = n.member(loc?.keeperUserId ?? null);
  return loc && keeper ? `從${loc.name}負責人 ${keeper} 的錢付` : null;
}

/** 場地卡的收費那一行。 */
function billingText(venue: FinanceVenue, packs: FinancePack[], n: Names): string {
  if (venue.perSessionPrice !== null) {
    const landlord = n.member(venue.landlordUserId);
    return `每次 ${money(venue.perSessionPrice)}${landlord ? `（付給${landlord}）` : ""}`;
  }
  const cur = currentPack(venue.id, packs);
  if (!cur) return "次數包 · 還沒有包";
  const left = sessionsLeft(venue.id, packs);
  // 開帳前手上的那包（購買日記成 1970 年）：只知道還剩幾次，不說「這包幾次多少錢」。
  if (new Date(cur.purchasedAt).getUTCFullYear() < 2000) {
    return `次數包 · 開帳前手上的 · ${left > 0 ? `還剩 ${left} 次（每次 ${money(packUnit(cur))}）` : "用完了，記得買新的一包"}`;
  }
  return `次數包 · 目前這包 ${cur.sessions} 次 ${money(cur.price)}（每次 ${money(packUnit(cur))}）· ${
    left > 0 ? `還剩 ${left} 次` : "用完了，記得買新的一包"
  }`;
}

/** 場地（房東、分部、收費方式）與次數包。每個場地一張卡，次數包列在它的場地下面。 */
export default function VenueSettings() {
  const { data } = useGetFinanceVenuesQuery();
  const { data: packData } = useGetFinancePacksQuery();
  const { data: locData } = useGetFinanceLocationsQuery();
  const { data: opening } = useGetOpeningQuery();
  const { allMembers } = useFinanceMembers();
  const [editing, setEditing] = useState<FinanceVenue | "new" | null>(null);
  const [buying, setBuying] = useState<FinanceVenue | null>(null);

  // 載入中不要先顯示空的
  if (!data || !packData || !locData) return <Skeleton className="h-24 w-full rounded-xl" />;

  const venues = [...data.venues].sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || a.id - b.id);
  const packs = packData.packs;
  const names: Names = {
    member: (id) => (id === null ? null : (allMembers.find((m) => m.userId === id)?.name ?? null)),
    location: (id) => locData.locations.find((l) => l.id === id),
  };
  const opened = !!opening?.opened;

  return (
    <div className="flex flex-col gap-3">
      {venues.length > 0 && (
        <ul className="flex flex-col gap-3">
          {venues.map((v) => (
            <VenueCard
              key={v.id}
              venue={v}
              packs={packs}
              names={names}
              opened={opened}
              onEdit={() => setEditing(v)}
              onBuy={() => setBuying(v)}
            />
          ))}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={() => setEditing("new")}>
          ＋新增場地
        </Button>
      </div>
      <VenueForm
        open={editing !== null}
        venue={editing === "new" ? null : editing}
        packs={packs}
        locations={locData.locations}
        opened={opened}
        names={names}
        onClose={() => setEditing(null)}
      />
      <PackForm
        open={buying !== null}
        venue={buying}
        payerText={buying ? payerText(buying, names) : null}
        onClose={() => setBuying(null)}
      />
    </div>
  );
}

function VenueCard({
  venue,
  packs,
  names,
  opened,
  onEdit,
  onBuy,
}: {
  venue: FinanceVenue;
  packs: FinancePack[];
  names: Names;
  opened: boolean;
  onEdit: () => void;
  onBuy: () => void;
}) {
  const [update] = useUpdateFinanceVenueMutation();
  const [remove, { isLoading: removing }] = useDeleteFinanceVenueMutation();
  const [voidPack] = useDeletePackMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPack = venue.perSessionPrice === null;
  const loc = names.location(venue.locationId);
  const landlord = names.member(venue.landlordUserId);
  // 作廢的包也列出來（灰的），新的在上面
  const venuePacks = packs.filter((p) => p.venueId === venue.id);
  const live = activePacks(venue.id, packs);
  // 從沒用過才能刪：伺服器還會看分帳規則和帳本，這裡先擋有包的
  const hasPacks = venuePacks.length > 0;

  const act = async (p: Promise<unknown>, fallback: string) => {
    try {
      await p;
    } catch (e) {
      toast.error(financeErrorText(e, fallback));
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-900">{venue.name}</span>
            {venue.archivedAt && <StatusTag tone="neutral">已封存</StatusTag>}
          </div>
          <span className="text-[13px] text-neutral-600">
            {loc ? loc.name : <span className="text-warning-800">還沒選分部</span>}
            {" · "}
            {landlord ? `房東 ${landlord}` : "沒有房東"}
          </span>
        </div>
        {isPack && opened && !venue.archivedAt && (
          <Button variant="secondary" size="sm" onClick={onBuy}>
            ＋買一包
          </Button>
        )}
        <Button variant="ghost" size="iconSm" aria-label={`編輯 ${venue.name}`} onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label={`${venue.name} 的更多操作`} className="data-[state=open]:bg-neutral-100">
              <MoreHorizontal className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-1.5">
            <MenuItem
              icon={venue.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              onClick={() => {
                setMenuOpen(false);
                act(update({ id: venue.id, archived: !venue.archivedAt }).unwrap(), "存不了，請再試一次");
              }}
            >
              {venue.archivedAt ? "取消封存" : "封存"}
            </MenuItem>
            <MenuItem
              icon={<Trash2 className="size-4" />}
              danger
              disabled={hasPacks}
              hint={hasPacks ? "有次數包的場地只能封存" : "用在分帳規則裡的場地只能封存"}
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
            >
              刪除
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-sm text-neutral-800">
        <span className="text-neutral-500">收費 </span>
        {billingText(venue, packs, names)}
      </p>

      {isPack && venuePacks.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg bg-neutral-50 px-3">
          {venuePacks.map((p) => {
            const before = new Date(p.purchasedAt).getUTCFullYear() < 2000;
            const voided = !!p.voidedAt;
            return (
              <li key={p.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span className={`min-w-0 flex-1 ${voided ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                  {before ? "開帳前手上的" : `${new Date(p.purchasedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })} 買`}
                  {" · "}
                  {p.sessions} 次 {money(p.price)}（每次 {money(packUnit(p))}）
                  {!voided && ` · 用了 ${Math.min(p.used, p.sessions)} 次`}
                </span>
                {voided ? (
                  <StatusTag tone="neutral">已作廢</StatusTag>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => act(voidPack(p.id).unwrap(), "作廢不了，請再試一次")}
                    aria-label={`作廢這一包（${p.sessions} 次 ${money(p.price)}）`}
                  >
                    作廢
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isPack && live.length === 0 && !opened && (
        <p className="text-[13px] text-neutral-500">開帳前手上有包的話，按編輯填「還剩幾次」。</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`刪除「${venue.name}」？`}
        message="刪掉就不見了。用在分帳規則裡的場地不能刪，請改用封存。"
        confirmLabel="刪除"
        variant="danger"
        isLoading={removing}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await act(remove(venue.id).unwrap(), "刪不了，請再試一次");
          setConfirmDelete(false);
        }}
      />
    </li>
  );
}

type Billing = "perSession" | "pack";
const BILLING_OPTIONS = [
  { value: "perSession", label: "每次付" },
  { value: "pack", label: "買次數包" },
] as const;

/** 新增／編輯場地：名稱、分部、房東、收費方式（開帳前買次數包的話順便填手上這包）。 */
function VenueForm({
  open,
  venue,
  packs,
  locations,
  opened,
  names,
  onClose,
}: {
  open: boolean;
  venue: FinanceVenue | null;
  packs: FinancePack[];
  locations: FinanceLocation[];
  opened: boolean;
  names: Names;
  onClose: () => void;
}) {
  const { allMembers } = useFinanceMembers();
  const [create, { isLoading: creating }] = useCreateFinanceVenueMutation();
  const [update, { isLoading: updating }] = useUpdateFinanceVenueMutation();
  const [createPack, { isLoading: packing }] = useCreatePackMutation();

  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(NONE);
  const [landlord, setLandlord] = useState(NONE);
  const [billing, setBilling] = useState<Billing>("perSession");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [remaining, setRemaining] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(venue?.name ?? "");
    setLocationId(venue?.locationId ?? (locations.length === 1 ? locations[0].id : NONE));
    setLandlord(venue?.landlordUserId ?? NONE);
    setBilling(venue && venue.perSessionPrice === null ? "pack" : "perSession");
    setPrice(venue?.perSessionPrice != null ? String(venue.perSessionPrice) : "");
    setTotal("");
    setTotalPrice("");
    setRemaining("");
    setError("");
  }, [open, venue, locations]);

  // 開帳前、還沒有包 → 這裡順便填「手上這包」（開帳後改用「＋買一包」）
  const askHandPack = billing === "pack" && !opened && (!venue || activePacks(venue.id, packs).length === 0);
  const handFilled = total !== "" || totalPrice !== "" || remaining !== "";
  const handValid =
    isWhole(total, 1) && isWhole(totalPrice, 0) && isWhole(remaining, 1) && Number(remaining) <= Number(total);
  const hand = handValid ? beforePackValue(Number(total), Number(totalPrice), Number(remaining)) : null;

  const valid =
    name.trim() !== "" &&
    locationId !== NONE &&
    (billing === "pack" || isWhole(price, 0)) &&
    (!askHandPack || !handFilled || handValid);

  const loc = locations.find((l) => l.id === locationId);
  const keeper = names.member(loc?.keeperUserId ?? null);

  const submit = async () => {
    setError("");
    const body = {
      name: name.trim(),
      locationId,
      landlordUserId: landlord === NONE ? null : landlord,
      perSessionPrice: billing === "perSession" ? Number(price) : null,
    };
    try {
      const saved = venue ? (await update({ id: venue.id, ...body }).unwrap(), venue) : await create(body).unwrap();
      if (askHandPack && handValid) {
        await createPack({
          venueId: saved.id,
          before: { totalSessions: Number(total), totalPrice: Number(totalPrice), remaining: Number(remaining) },
        }).unwrap();
      }
      toast.success(venue ? "已儲存場地" : "已新增場地");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "存不了，請再試一次"));
    }
  };

  return (
    <Drawer
      title={venue ? "編輯場地" : "新增場地"}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitText={venue ? "儲存" : "新增"}
      isLoading={creating || updating || packing}
      disabled={!valid}
    >
      <div className="flex flex-col gap-4">
        <Field label="名稱" value={name} placeholder="例如：24steps、丁丁家" onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>分部</FieldLabel>
          <Select
            aria-label="場地的分部"
            value={locationId === NONE ? undefined : locationId}
            onChange={setLocationId}
            placeholder="選分部"
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
          />
          <p className="text-[13px] text-neutral-600">
            {loc
              ? keeper
                ? `場地費和次數包從${loc.name}負責人 ${keeper} 的錢付`
                : `${loc.name}還沒有負責人，先到分部設定`
              : "場地費和次數包從這個分部負責人的錢付"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>房東（選填）</FieldLabel>
          <Select
            aria-label="房東"
            value={landlord}
            onChange={setLandlord}
            options={[{ value: NONE, label: "沒有房東" }, ...allMembers.map((m) => ({ value: m.userId, label: m.name }))]}
          />
          <p className="text-[13px] text-neutral-600">房東是團隊成員的話，場地費會付給他</p>
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>收費方式</FieldLabel>
          <SegmentedTabs ariaLabel="收費方式" options={BILLING_OPTIONS} value={billing} onChange={setBilling} fill />
          {billing === "perSession" ? (
            <Field
              label="每次多少"
              inputMode="numeric"
              placeholder="例如 300"
              value={price}
              onChange={(e) => setPrice(digits(e.target.value))}
            />
          ) : askHandPack ? (
            <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3">
              <p className="text-sm font-medium text-neutral-900">手上這包（選填）</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="總共幾次" inputMode="numeric" value={total} onChange={(e) => setTotal(digits(e.target.value))} />
                <Field label="多少錢" inputMode="numeric" value={totalPrice} onChange={(e) => setTotalPrice(digits(e.target.value))} />
                <Field label="還剩幾次" inputMode="numeric" value={remaining} onChange={(e) => setRemaining(digits(e.target.value))} />
              </div>
              <p className="text-[13px] text-neutral-700" aria-live="polite">
                {hand
                  ? `每次 ${money(hand.unit)} · 剩下的價值 ${money(hand.value)}`
                  : handFilled && isWhole(remaining, 1) && Number(remaining) > Number(total)
                    ? "還剩的次數不能比總共多"
                    : "算成開帳前就付好的預付場地費，上課時先用這包"}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-neutral-600">
              {opened ? "在場地卡按「＋買一包」記次數包，每上一堂扣一次。" : "每上一堂從包裡扣一次。"}
            </p>
          )}
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
