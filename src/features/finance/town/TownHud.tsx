"use client";

import type { ReactNode } from "react";
import { BookOpen, CircleHelp, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { moneyText } from "../Money";
import { CartIcon, CoinIcon, CrateIcon, HammerIcon, KeepIcon } from "./icons";
import { KiwiAvatar, type KiwiAccessory } from "./sprites";
import {
  companyMoney,
  CUSTODIANS,
  heldDays,
  holdingOf,
  isOverdue,
  lastRejection,
  memberOf,
  pendingRemittances,
  TODAY,
  type MemberId,
  type TownState,
} from "./townModel";

/** HUD 膠囊（style doc §3.5）：白色全圓角＋柔和陰影。 */
const pill = "flex items-center gap-2 rounded-full bg-[#FFFDF7] shadow-[0_2px_0_rgba(77,66,57,.10),0_6px_18px_rgba(77,66,57,.10)]";
const roundButton =
  "grid place-items-center rounded-full border-4 border-[#F1E4C9] bg-[#FFFDF7] shadow-[0_3px_0_rgba(77,66,57,.12),0_8px_20px_rgba(77,66,57,.12)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer disabled:cursor-not-allowed";
const squareButton =
  "grid size-11 place-items-center rounded-[15px] bg-[#FFFDF7] text-[#5A4E44] shadow-[0_2px_0_rgba(77,66,57,.10),0_6px_18px_rgba(77,66,57,.10)] hover:bg-white cursor-pointer";

function Figure({ value, className }: { value: number; className?: string }) {
  return <span className={cn("font-semibold leading-none tabular-nums", className)}>{moneyText(value)}</span>;
}

function Mini({ icon, label, value, tone = "plain" }: { icon: ReactNode; label: string; value: ReactNode; tone?: "plain" | "fund" | "wait" | "grow" }) {
  return (
    <div className={cn("flex h-[30px] items-center gap-1.5 rounded-full pl-1.5 pr-3 shadow-[0_2px_0_rgba(77,66,57,.08)]", tone === "fund" ? "bg-[#EAF7EF]" : "bg-[#FFFDF7]/95")}>
      {icon}
      <span className={cn("text-xs", tone === "fund" ? "font-bold text-primary-700" : "text-[#8C7B6B]")}>{label}</span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "fund" && "text-primary-900",
          tone === "wait" && "text-[#C2700F]",
          tone === "grow" && "text-[#4E9A2F]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Badge({ size }: { size: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-[3px] border-[#FFFDF7] bg-[linear-gradient(#BFE6E3,#E7F4E6)] shadow-[0_4px_14px_rgba(77,66,57,.16)]",
        big ? "size-20" : "size-12"
      )}
    >
      <KeepIcon size={big ? 48 : 28} />
      <span className={cn("absolute -bottom-1 -left-1.5 rounded-full border-2 border-[#FFFDF7] bg-[#F4A23C] font-bold text-white", big ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[10px]")}>
        {Number(TODAY.slice(5, 7))}月
      </span>
    </div>
  );
}

/** 上方的資源列：公司的錢、財庫、還在路上、回本；第二排是預收／待發／基金（電腦版）。 */
export function HudTop({ state, variant, onLedger, onLegend }: { state: TownState; variant: "wide" | "tall"; onLedger: () => void; onLegend: () => void }) {
  const money = companyMoney(state);
  if (variant === "tall") {
    return (
      <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <Badge size="sm" />
          <div className={cn(pill, "h-11 min-w-0 flex-1 pl-1.5 pr-4")}>
            <span className="grid size-8 place-items-center rounded-full bg-[#FFF3D9]">
              <CoinIcon />
            </span>
            <Figure value={money.total} className="text-[21px]" />
            <span className="truncate text-xs text-[#8C7B6B]">公司的錢</span>
          </div>
          <button type="button" onClick={onLedger} aria-label="帳本模式" className={squareButton}>
            <BookOpen className="size-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onLegend} aria-label="這些圖代表什麼" className={squareButton}>
            <CircleHelp className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Mini icon={<KeepIcon size={20} />} label="財庫" value={moneyText(money.vault)} />
          <Mini icon={<CartIcon size={20} />} label="路上" value={moneyText(money.transit)} tone="wait" />
          <Mini icon={<HammerIcon size={18} />} label="回本" value={`${Math.round(money.recovery * 100)}%`} tone="grow" />
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-3 flex items-start gap-3">
        <div className="pointer-events-auto">
          <Badge size="lg" />
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={cn(pill, "h-10 pl-1 pr-4")}>
              <span className="grid size-8 place-items-center rounded-full bg-[#FFF3D9]">
                <CoinIcon />
              </span>
              <Figure value={money.total} className="text-[21px]" />
              <span className="text-xs text-[#8C7B6B]">公司的錢</span>
            </div>
            <div className={cn(pill, "h-10 pl-1 pr-4")}>
              <span className="grid size-8 place-items-center rounded-full bg-primary-100">
                <KeepIcon />
              </span>
              <Figure value={money.vault} className="text-[21px]" />
              <span className="text-xs text-[#8C7B6B]">主堡財庫</span>
            </div>
            <div className={cn(pill, "h-10 pl-1 pr-4")}>
              <span className="grid size-8 place-items-center rounded-full bg-[#FFF0DD]">
                <CartIcon />
              </span>
              <Figure value={money.transit} className="text-[21px] text-[#C2700F]" />
              <span className="text-xs text-[#8C7B6B]">還在路上</span>
            </div>
            <div className={cn(pill, "h-10 w-[290px] pl-1 pr-3.5 @max-[1100px]:hidden")}>
              <span className="grid size-8 place-items-center rounded-full bg-[#EEF3F7]">
                <HammerIcon />
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between text-[11.5px] text-[#8C7B6B]">
                  <span>建城貸款 ${moneyText(money.loan)}</span>
                  <span className="font-bold text-[#4E9A2F]">回本 {Math.round(money.recovery * 100)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#E7EFD8]">
                  <div className="h-full rounded-full bg-[#86C64F]" style={{ width: `${Math.max(2, money.recovery * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Mini icon={<CrateIcon tone="prepaid" />} label="預收" value={moneyText(money.prepaid)} />
            <Mini icon={<CrateIcon tone="payable" />} label="待發" value={moneyText(money.payable)} />
            <Mini icon={<CrateIcon tone="fund" />} label="基金・真正能用" value={moneyText(money.fund)} tone="fund" />
          </div>
        </div>
      </div>
      <div className="absolute right-4 top-3 flex gap-2">
        <button type="button" onClick={onLedger} aria-label="帳本模式" className={squareButton}>
          <BookOpen className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onLegend} aria-label="這些圖代表什麼" className={squareButton}>
          <CircleHelp className="size-5" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

interface BackpackRow {
  id: MemberId | `transit-${string}` | "boss";
  member: MemberId;
  accessory?: KiwiAccessory;
  avatarBg: string;
  name: string;
  amount: number;
  tag: string;
  tone: "ok" | "wait" | "late" | "plain";
  slotBg: string;
}

/** 背包卡／背包列的每一格：代收人手上的、路上的、老闆自己收的。 */
function backpackRows(state: TownState): BackpackRow[] {
  const rows: BackpackRow[] = [];
  for (const m of CUSTODIANS) {
    const holding = holdingOf(state, m.id);
    const late = isOverdue(state, m.id);
    const rejected = lastRejection(state, m.id);
    rows.push({
      id: m.id,
      member: m.id,
      accessory: holding > 0 ? (late ? "sack" : "pack") : undefined,
      avatarBg: late ? "#EAF1FB" : "#E3F7F0",
      name: m.name,
      amount: holding,
      tag: late ? `${heldDays(state, m.id)} 天沒繳` : rejected ? "被退回" : holding > 0 ? "手上" : "都交了",
      tone: late ? "late" : rejected ? "wait" : holding > 0 ? "ok" : "plain",
      slotBg: "#FFF8EC",
    });
  }
  for (const r of pendingRemittances(state)) {
    rows.push({
      id: `transit-${r.id}`,
      member: r.fromId,
      accessory: "cap",
      avatarBg: "#FFFFFF",
      name: `${memberOf(r.fromId).name} → 主堡`,
      amount: r.amount,
      tag: "! 等確認",
      tone: "wait",
      slotBg: "#FFF1DE",
    });
  }
  return rows;
}

const TAG_TONE: Record<BackpackRow["tone"], string> = {
  ok: "bg-primary-100 text-primary-900",
  wait: "bg-[#F4A23C] text-white",
  late: "bg-[#FBE1DC] text-[#C4473A]",
  plain: "bg-white text-[#8C7B6B]",
};

/** 電腦版左邊的「代收人背包」卡；手機版是下方可以左右滑的一排。點一格打開那個人的背包。 */
export function Backpacks({ state, variant, onOpen }: { state: TownState; variant: "card" | "strip"; onOpen: (id: MemberId) => void }) {
  const rows = backpackRows(state);
  const owner = memberOf("boss");
  const ownerMonth = state.collections.filter((c) => c.receiverId === owner.id && c.date.startsWith(TODAY.slice(0, 7))).reduce((a, c) => a + c.amount, 0);
  const slot = (row: BackpackRow) => (
    <button
      key={row.id}
      type="button"
      onClick={() => onOpen(row.member)}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 text-left transition-transform hover:-translate-y-0.5 cursor-pointer",
        variant === "card" ? "rounded-[14px] px-2 py-1.5" : "rounded-2xl bg-[#FFFDF7] py-1 pl-1 pr-3 shadow-[0_2px_0_rgba(77,66,57,.10),0_6px_16px_rgba(77,66,57,.12)]"
      )}
      style={variant === "card" ? { background: row.slotBg } : row.tone === "wait" ? { background: "#FFF1DE" } : undefined}
    >
      <KiwiAvatar scarf={row.accessory === "cap" ? "#6FA8DC" : memberOf(row.member).scarf} accessory={row.accessory} bg={row.avatarBg} size={variant === "card" ? 38 : 34} />
      <span className="flex flex-col">
        <span className="text-[12.5px] font-bold leading-tight">{row.name}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[17px] font-semibold leading-tight tabular-nums">${moneyText(row.amount)}</span>
          {variant === "strip" && <span className={cn("whitespace-nowrap rounded-full px-1.5 text-[10.5px] font-bold", TAG_TONE[row.tone])}>{row.tag}</span>}
        </span>
        {variant === "card" && <span className={cn("mt-0.5 w-fit rounded-full px-1.5 text-[10.5px] font-bold", TAG_TONE[row.tone])}>{row.tag}</span>}
      </span>
    </button>
  );
  if (variant === "strip") {
    return <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pr-3 pt-0.5 [scrollbar-width:none]">{rows.map(slot)}</div>;
  }
  return (
    <div className="flex w-[180px] flex-col gap-2 overflow-hidden rounded-[20px] bg-[#FFFDF7] px-2.5 pt-3 shadow-[0_4px_0_rgba(77,66,57,.08),0_10px_24px_rgba(77,66,57,.12)]">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-black">代收人背包</span>
        <span className="text-[11px] text-[#8C7B6B]">還沒入庫</span>
      </div>
      {rows.map(slot)}
      <button
        type="button"
        onClick={() => onOpen(owner.id)}
        className="flex min-h-11 items-center gap-2 rounded-[14px] bg-[#F3F7EC] px-2 py-1.5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer"
      >
        <KiwiAvatar scarf={owner.scarf} accessory="crown" bg="#FFF6D8" />
        <span className="flex flex-col">
          <span className="text-[12.5px] font-bold leading-tight">老闆自己收</span>
          <span className="text-[17px] font-semibold leading-tight tabular-nums">${moneyText(ownerMonth)}</span>
          <span className="mt-0.5 w-fit rounded-full bg-white px-1.5 text-[10.5px] font-bold text-[#8C7B6B]">本月直接入庫</span>
        </span>
      </button>
      <svg width="100%" height="28" viewBox="0 0 180 28" preserveAspectRatio="none" aria-hidden="true" className="-mx-2.5 block w-[calc(100%+20px)]">
        <defs>
          <pattern id="town-seigaiha" width="24" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 12a12 12 0 0 1 24 0M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0" fill="none" stroke="#F2B39A" strokeWidth="1.6" />
          </pattern>
        </defs>
        <rect width="180" height="28" fill="#FCE9DF" />
        <rect width="180" height="28" fill="url(#town-seigaiha)" />
      </svg>
    </div>
  );
}

/** 動作按鈕：帳本模式、我的背包、送回主堡、記一筆。老闆沒有背包、不用送回；只有老闆能記一筆。 */
export function HudActions({
  state,
  viewer,
  variant,
  onLedger,
  onMine,
  onRemit,
  onExpense,
}: {
  state: TownState;
  viewer: MemberId;
  variant: "round" | "bar";
  onLedger: () => void;
  onMine: () => void;
  onRemit: () => void;
  onExpense: () => void;
}) {
  const me = memberOf(viewer);
  const holding = holdingOf(state, viewer);
  if (variant === "bar") {
    const bar = "flex h-[52px] w-[84px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-900 text-xs font-bold text-white shadow-[0_3px_0_#0f3a2d] cursor-pointer";
    return me.isOwner ? (
      <button type="button" onClick={onExpense} className={bar}>
        <PencilLine className="size-5" aria-hidden="true" />
        記一筆
      </button>
    ) : (
      <button type="button" onClick={onRemit} disabled={holding <= 0} className={cn(bar, "disabled:bg-neutral-300 disabled:text-neutral-600 disabled:shadow-none disabled:cursor-not-allowed")}>
        <CartIcon size={24} />
        {holding > 0 ? "送回主堡" : "背包空了"}
      </button>
    );
  }
  const buttons: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean }[] = [
    { label: "帳本模式", icon: <BookOpen className="size-7 text-[#5A4E44]" aria-hidden="true" />, onClick: onLedger },
    ...(me.isOwner
      ? [{ label: "記一筆", icon: <PencilLine className="size-7 text-[#5A4E44]" aria-hidden="true" />, onClick: onExpense, accent: true }]
      : [
          { label: "我的背包", icon: <KiwiAvatar scarf={me.scarf} accessory="pack" bg="#FFFFFF" size={34} />, onClick: onMine },
          { label: "送回主堡", icon: <CartIcon size={32} />, onClick: onRemit, disabled: holding <= 0, accent: true },
        ]),
  ];
  return (
    <div className="flex justify-center gap-6">
      {buttons.map((b) => (
        <div key={b.label} className="flex flex-col items-center">
          <button type="button" onClick={b.onClick} disabled={b.disabled} aria-label={b.label} className={cn(roundButton, "size-[68px]", b.accent && "border-[#FCD9B0]")}>
            {b.icon}
          </button>
          <span className="mt-1.5 rounded-full bg-[#FFFDF7]/95 px-2.5 py-0.5 text-xs font-bold">{b.disabled ? "背包是空的" : b.label}</span>
        </div>
      ))}
    </div>
  );
}
