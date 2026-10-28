"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Field, { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import FilterChip from "@/components/FilterChip";
import SegmentedTabs from "@/components/SegmentedTabs";
import StatusTag from "@/components/StatusTag";
import { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { cn } from "@/lib/utils";
import { moneyText } from "../Money";
import { OptionCard } from "../ui";
import { CartIcon, CoinIcon, CrateIcon, HammerIcon, HouseIcon, KeepIcon, StudioIcon } from "./icons";
import { KiwiAvatar } from "./sprites";
import {
  CATEGORY_LABELS,
  companyMoney,
  daysBetween,
  EXPENSE_CATEGORIES,
  heldDays,
  holdingOf,
  isOverdue,
  lastRejection,
  ledgerRows,
  memberOf,
  MEMBERS,
  pendingRemittances,
  PLACE_CATEGORIES,
  placeEntries,
  PLACES,
  remittancesOf,
  remitAmountError,
  dollars,
  SETTINGS,
  TODAY,
  vaultMonthFlow,
  type EntryCategory,
  type MemberId,
  type PayMethod,
  type Place,
  type RemitStatus,
  type TownState,
} from "./townModel";

const methodText = (method: PayMethod, ref?: string) => (method === "cash" ? "現金" : `轉帳${ref ? ` · 末五碼 ${ref}` : ""}`);
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 抽屜的標題列：圖示、標題、一行說明、關閉。 */
function PanelHeader({ icon, title, sub, onClose }: { icon: ReactNode; title: string; sub: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="min-w-0 flex-1">
        <ResponsiveDialogTitle className="text-lg font-black">{title}</ResponsiveDialogTitle>
        <p className="text-[13px] text-[#8C7B6B]">{sub}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="關閉" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F4EEE3] text-[#5A4E44] hover:bg-[#EDE4D6] cursor-pointer">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function KeepBadge() {
  return (
    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(#BFE6E3,#E7F4E6)]">
      <KeepIcon size={32} />
    </div>
  );
}

function CourierAvatar({ size = 44 }: { size?: number }) {
  return (
    <span className="relative shrink-0">
      <KiwiAvatar scarf="#6FA8DC" accessory="cap" bg="#FFFFFF" size={size} />
      <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-[#FFF4E4] bg-[#F4A23C] text-xs font-bold text-white">!</span>
    </span>
  );
}

/** 一筆等確認的繳回。老闆看得到「收到了／金額不對」；送的人自己看得到「撤回」。 */
function PendingItem({
  id,
  state,
  viewer,
  onConfirm,
  onReject,
  onWithdraw,
}: {
  id: string;
  state: TownState;
  viewer: MemberId;
  onConfirm: (id: string, amount: number) => void;
  onReject: (id: string, reason: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const r = state.remittances.find((x) => x.id === id);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  if (!r) return null;
  const owner = memberOf(viewer).isOwner;
  const waited = daysBetween(r.date, TODAY);
  const submitReject = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("寫一下哪裡不對，對方才知道怎麼改");
      return;
    }
    onReject(r.id, reason.trim());
  };
  return (
    <li className="flex flex-col gap-3 rounded-[18px] bg-[#FFF4E4] p-3">
      <div className="flex items-center gap-3">
        <CourierAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">
            {memberOf(r.fromId).name}送來 <span className="text-lg tabular-nums">${moneyText(r.amount)}</span>
          </p>
          <p className="text-[13px] text-[#B86A12]">
            {shortDate(r.date)} · {methodText(r.method, r.ref)} · {waited === 0 ? "今天送的" : `等了 ${waited} 天`}
            {waited >= SETTINGS.confirmLimitDays && "，超過期限了"}
          </p>
          {r.note && <p className="mt-0.5 text-[13px] text-[#8C7B6B]">備註：{r.note}</p>}
        </div>
      </div>
      {owner && !rejecting && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onConfirm(r.id, r.amount)}>
            收到了
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setRejecting(true)}>
            金額不對
          </Button>
        </div>
      )}
      {owner && rejecting && (
        <form onSubmit={submitReject} className="flex flex-col gap-2">
          <FieldLabel htmlFor={reasonId}>哪裡不對？</FieldLabel>
          <textarea
            id={reasonId}
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="例如：現金只有 $5,600，少了 $200"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${reasonId}-error` : undefined}
            className={cn(fieldControlClass(!!error), "min-h-20 py-3")}
            autoFocus
          />
          <FieldError id={`${reasonId}-error`}>{error}</FieldError>
          <div className="flex gap-2">
            <Button type="submit" variant="dangerSecondary" className="flex-1">
              退回給{memberOf(r.fromId).name}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              取消
            </Button>
          </div>
        </form>
      )}
      {!owner && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-[#8C7B6B]">老闆按「收到了」才算入庫。</p>
          {viewer === r.fromId && (
            <Button size="sm" variant="secondary" onClick={() => onWithdraw(r.id)}>
              撤回
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function KeepPanel({
  state,
  viewer,
  onConfirm,
  onReject,
  onWithdraw,
  onLedger,
  onClose,
}: {
  state: TownState;
  viewer: MemberId;
  onConfirm: (id: string, amount: number) => void;
  onReject: (id: string, reason: string) => void;
  onWithdraw: (id: string) => void;
  onLedger: () => void;
  onClose: () => void;
}) {
  const money = companyMoney(state);
  const pending = pendingRemittances(state);
  const owner = memberOf(viewer).isOwner;
  const parts = [
    { tone: "prepaid" as const, label: "預收", hint: "學生付了、還沒上的課", value: money.prepaid, color: "#D9D2C4" },
    { tone: "payable" as const, label: "待發", hint: "上過課、還沒付的薪水和場地費", value: money.payable, color: "#F0B48A" },
    { tone: "fund" as const, label: "水庫基金・真正能用的", hint: "Party、公共支出從這裡出", value: money.fund, color: "#5DB48D" },
  ];
  const positive = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader icon={<KeepBadge />} title="主堡 · 高雄" sub="老闆保管 · 公司的錢，不是老闆的薪水" onClose={onClose} />

      {pending.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="等老闆確認">
          <h3 className="text-sm font-black">{owner ? `等你確認（${pending.length}）` : `等老闆確認（${pending.length}）`}</h3>
          <ul className="flex flex-col gap-2">
            {pending.map((r) => (
              <PendingItem key={r.id} id={r.id} state={state} viewer={viewer} onConfirm={onConfirm} onReject={onReject} onWithdraw={onWithdraw} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-3 rounded-[20px] bg-[#F6F1E6] px-4 py-3.5">
        <CoinIcon size={42} />
        <div className="flex-1">
          <p className="text-[12.5px] text-[#8C7B6B]">財庫裡</p>
          <p className="text-[32px] font-semibold leading-tight tabular-nums">${moneyText(money.vault)}</p>
        </div>
        <div className="text-right text-xs leading-relaxed text-[#8C7B6B]">
          還在路上 <b className="text-sm tabular-nums text-[#C2700F]">+{moneyText(money.transit)}</b>
          <br />
          代收人手上 <b className="text-sm tabular-nums text-[#4D4239]">+{moneyText(money.custody)}</b>
          <br />
          公司的錢 <b className="text-sm tabular-nums text-[#4D4239]">{moneyText(money.total)}</b>
        </div>
      </div>

      <VaultHistory state={state} onLedger={onLedger} />

      <section className="flex flex-col gap-2.5 border-t-2 border-dashed border-[#EADFCB] pt-4">
        <h3 className="text-sm font-black">這 ${moneyText(money.total)} 是誰的？</h3>
        <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.tone} style={{ width: `${(Math.max(0, p.value) / positive) * 100}%`, background: p.color }} />
          ))}
        </div>
        {parts.map((p) => (
          <div key={p.tone} className={cn("flex items-center gap-2.5", p.tone === "fund" && "-mx-2.5 rounded-[14px] bg-[#EAF7EF] px-2.5 py-2")}>
            <CrateIcon tone={p.tone} size={26} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-bold", p.tone === "fund" && "font-black text-primary-900")}>{p.label}</p>
              <p className={cn("text-xs", p.tone === "fund" ? "text-primary-700" : "text-[#8C7B6B]")}>{p.hint}</p>
            </div>
            <span className={cn("text-lg font-semibold tabular-nums", p.tone === "fund" && "text-primary-900", p.value < 0 && "text-[#C4473A]")}>
              {dollars(p.value)}
            </span>
          </div>
        ))}
        <p className="text-xs text-[#8C7B6B]">預收、待發要等分帳接上點名才算得出來，示意版先用固定數字。</p>
      </section>

      <section className="flex flex-col gap-2 border-t-2 border-dashed border-[#EADFCB] pt-4">
        <div className="flex items-center gap-2.5">
          <HammerIcon size={26} />
          <p className="flex-1 text-sm font-bold">建城貸款（欠老闆的）</p>
          <span className="text-base font-semibold tabular-nums">${moneyText(money.loan)}</span>
        </div>
        <div className="h-3.5 overflow-hidden rounded-full bg-[#E7EFD8]">
          <div className="h-full rounded-full bg-[#86C64F]" style={{ width: `${Math.max(2, money.recovery * 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-[#8C7B6B]">
          <span>回本 {Math.round(money.recovery * 100)}%（基金 ÷ 欠老闆的，暫定）</span>
          <span>
            公司淨值 <b className={cn("tabular-nums", money.netWorth < 0 ? "text-[#C4473A]" : "text-primary-900")}>{dollars(money.netWorth)}</b>
          </span>
        </div>
      </section>
    </div>
  );
}

const signed = (value: number) => (value > 0 ? `+${dollars(value)}` : dollars(value));

/** 主堡的進出：老闆自己收的、確認入庫的繳回、手記的支出和補錢——就是帳本模式「主堡」那一份。 */
function VaultHistory({ state, onLedger }: { state: TownState; onLedger: () => void }) {
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [expanded, setExpanded] = useState(false);
  const flow = vaultMonthFlow(state);
  const rows = ledgerRows(state)
    .filter((r) => r.scope === "vault")
    .filter((r) => filter === "all" || (filter === "in" ? r.amount > 0 : r.amount < 0));
  const shown = expanded ? rows : rows.slice(0, 6);
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-black">主堡的進出</h3>
        <span className="text-xs text-[#8C7B6B]">
          {Number(TODAY.slice(5, 7))} 月 進 <b className="tabular-nums text-[#4E9A2F]">+{moneyText(flow.inflow)}</b> · 出 <b className="tabular-nums text-[#C4473A]">−{moneyText(flow.outflow)}</b>
        </span>
      </div>
      <div className="flex gap-2">
        {(
          [
            ["all", "全部"],
            ["in", "進來的"],
            ["out", "花掉的"],
          ] as const
        ).map(([value, label]) => (
          <FilterChip key={value} size="sm" active={filter === value} onClick={() => setFilter(value)}>
            {label}
          </FilterChip>
        ))}
      </div>
      <ul className="divide-y divide-[#EADFCB]">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <span className="w-10 shrink-0 text-[13px] tabular-nums text-[#8C7B6B]">{shortDate(r.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{r.title}</span>
              {r.detail && <span className="block text-xs text-[#8C7B6B]">{r.detail}</span>}
            </span>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", r.amount > 0 ? "text-[#4E9A2F]" : "text-[#C4473A]")}>{signed(r.amount)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-sm text-[#8C7B6B]">這段時間沒有{filter === "in" ? "進來的錢" : "花費"}。</li>}
        {(expanded || rows.length <= 6) && filter !== "out" && (
          <li className="flex items-center gap-3 py-2 text-[13px] text-[#8C7B6B]">
            <span className="w-10 shrink-0 tabular-nums">9/30</span>
            <span className="flex-1">期初（開始記帳時主堡裡有的）</span>
            <span className="font-semibold tabular-nums">$48,000</span>
          </li>
        )}
      </ul>
      <div className="flex items-center justify-between">
        {rows.length > 6 ? (
          <Button variant="link" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起來" : `顯示全部 ${rows.length} 筆`}
          </Button>
        ) : (
          <span />
        )}
        <Button variant="link" size="sm" onClick={onLedger}>
          切到帳本模式 ›
        </Button>
      </div>
    </section>
  );
}

export function PersonPanel({
  state,
  id,
  viewer,
  onRemit,
  onWithdraw,
  onClose,
}: {
  state: TownState;
  id: MemberId;
  viewer: MemberId;
  onRemit: () => void;
  onWithdraw: (id: string) => void;
  onClose: () => void;
}) {
  const member = memberOf(id);
  const month = TODAY.slice(0, 7);
  const collections = state.collections.filter((c) => c.receiverId === id).sort((a, b) => b.date.localeCompare(a.date));
  if (member.isOwner) {
    const mine = collections.filter((c) => c.date.startsWith(month));
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader
          icon={<KiwiAvatar scarf={member.scarf} accessory="crown" bg="#FFF6D8" size={48} />}
          title={member.name}
          sub="營收負責人 · 自己收的錢直接進主堡，沒有背包"
          onClose={onClose}
        />
        <div className="rounded-[20px] bg-[#F3F7EC] px-4 py-3">
          <p className="text-[12.5px] text-[#8C7B6B]">{Number(month.slice(5))} 月自己收的</p>
          <p className="text-[28px] font-semibold tabular-nums">${moneyText(mine.reduce((a, c) => a + c.amount, 0))}</p>
        </div>
        <CollectionList items={collections} title="自己收的課卡錢" />
      </div>
    );
  }
  const holding = holdingOf(state, id);
  const late = isOverdue(state, id);
  const rejected = lastRejection(state, id);
  const pending = pendingRemittances(state).filter((r) => r.fromId === id);
  const history = remittancesOf(state, id).filter((r) => r.status !== "pending");
  const isMe = viewer === id;
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        icon={<KiwiAvatar scarf={member.scarf} accessory={holding > 0 ? (late ? "sack" : "pack") : undefined} size={48} />}
        title={isMe ? "我的背包" : `${member.name}的背包`}
        sub={isMe ? "你在課卡頁「確認收款」選自己的錢，都會在這裡" : "大家都看得到，只有本人能送回主堡"}
        onClose={onClose}
      />
      <div className="flex items-center gap-3 rounded-[20px] bg-[#FFF8EC] px-4 py-3">
        <CoinIcon size={40} />
        <div className="flex-1">
          <p className="text-[12.5px] text-[#8C7B6B]">手上還沒交</p>
          <p className="text-[30px] font-semibold leading-tight tabular-nums">${moneyText(holding)}</p>
        </div>
        {late && <span className="rounded-full bg-[#FBE1DC] px-2.5 py-1 text-xs font-bold text-[#C4473A]">{heldDays(state, id)} 天沒繳</span>}
      </div>
      {rejected && (
        <p role="status" className="rounded-2xl bg-[#FFF1DE] px-4 py-3 text-sm text-[#8A4510]">
          <b>老闆退回了 ${moneyText(rejected.amount)}：</b>
          {rejected.reason}。錢回到背包了，改好再送一次。
        </p>
      )}
      {isMe && (
        <Button size="lg" onClick={onRemit} disabled={holding <= 0}>
          <CartIcon className="size-6 shrink-0" />
          {holding > 0 ? `送回主堡（$${moneyText(holding)}）` : "背包是空的"}
        </Button>
      )}
      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-black">在路上</h3>
          <ul className="flex flex-col gap-2">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-[18px] bg-[#FFF4E4] p-3">
                <CourierAvatar size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold tabular-nums">${moneyText(r.amount)}</p>
                  <p className="text-[13px] text-[#B86A12]">
                    {shortDate(r.date)} · {methodText(r.method, r.ref)} · 等老闆確認
                  </p>
                </div>
                {isMe && (
                  <Button size="sm" variant="secondary" onClick={() => onWithdraw(r.id)}>
                    撤回
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CollectionList items={collections} title="收到的課卡錢" />
      {history.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-black">送回主堡的紀錄</h3>
          <ul className="divide-y divide-[#EADFCB]">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[#8C7B6B]">{shortDate(r.date)}</span> {methodText(r.method, r.ref)}
                    <StatusTag tone={REMIT_STATUS[r.status].tone}>{REMIT_STATUS[r.status].label}</StatusTag>
                  </span>
                  {r.reason && <span className="block text-xs text-[#8A4510]">退回原因：{r.reason}</span>}
                  {r.note && <span className="block text-xs text-[#8C7B6B]">備註：{r.note}</span>}
                </span>
                <span className={cn("shrink-0 font-semibold tabular-nums", r.status === "confirmed" ? "text-primary-900" : "text-[#8C7B6B] line-through")}>
                  −${moneyText(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const REMIT_STATUS: Record<RemitStatus, { label: string; tone: "positive" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "等確認", tone: "warning" },
  confirmed: { label: "已入庫", tone: "positive" },
  rejected: { label: "被退回", tone: "danger" },
  withdrawn: { label: "撤回了", tone: "neutral" },
};

/** 點台南丁丁家、高雄教室：這個地方的規則、在這裡的人、場地費和助教費紀錄。不顯示地區收入——課卡兩地共用。 */
export function PlacePanel({
  state,
  place,
  onPerson,
  onClose,
}: {
  state: TownState;
  place: Place;
  onPerson: (id: MemberId) => void;
  onClose: () => void;
}) {
  const info = PLACES[place];
  const entries = placeEntries(state, place);
  const month = TODAY.slice(0, 7);
  const monthTotal = -entries.filter((e) => e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        icon={
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", place === "tainan" ? "bg-[#FDE8DE]" : "bg-[#E3F1EC]")}>
            {place === "tainan" ? <HouseIcon size={32} /> : <StudioIcon size={32} />}
          </div>
        }
        title={info.name}
        sub="上課的地方 · 不各自存錢，錢都回主堡"
        onClose={onClose}
      />
      <ul className="flex flex-col gap-1.5 rounded-[20px] bg-[#F6F1E6] px-4 py-3 text-sm">
        {info.rules.map((rule) => (
          <li key={rule} className="flex gap-2">
            <span aria-hidden="true" className="text-[#B98858]">●</span>
            {rule}
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-black">在這裡的人</h3>
        <div className="flex flex-col gap-2">
          {info.members.map((id) => {
            const m = memberOf(id);
            const holding = holdingOf(state, id);
            const late = isOverdue(state, id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPerson(id)}
                className="flex min-h-11 items-center gap-3 rounded-[16px] bg-[#FFF8EC] px-3 py-2 text-left hover:bg-[#FFF1DE] cursor-pointer"
              >
                <KiwiAvatar scarf={m.scarf} accessory={m.isOwner ? "crown" : holding > 0 ? (late ? "sack" : "pack") : undefined} bg={m.isOwner ? "#FFF6D8" : "#E3F7F0"} />
                <span className="flex-1">
                  <span className="block text-sm font-bold">{m.name}</span>
                  <span className="block text-xs text-[#8C7B6B]">{m.isOwner ? "營收負責人 · 收的錢直接進主堡" : `背包裡 $${moneyText(holding)}${late ? ` · ${heldDays(state, id)} 天沒繳` : ""}`}</span>
                </span>
                <span className="text-xs font-bold text-primary-700">看背包 ›</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-black">場地費、助教費</h3>
          <span className="text-xs text-[#8C7B6B]">
            {Number(month.slice(5))} 月共 <b className="tabular-nums text-[#C4473A]">−${moneyText(monthTotal)}</b>（主堡付的）
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#EADFCB] px-4 py-3 text-sm text-[#8C7B6B]">還沒有紀錄。</p>
        ) : (
          <ul className="divide-y divide-[#EADFCB]">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="w-10 shrink-0 text-[13px] tabular-nums text-[#8C7B6B]">{shortDate(e.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {CATEGORY_LABELS[e.category]} · {e.note}
                  </span>
                  {e.payee && <span className="block text-xs text-[#8C7B6B]">付給 {e.payee}</span>}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#C4473A]">{dollars(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs leading-relaxed text-[#8C7B6B]">課卡台南、高雄共用，學生付的錢不分地區，都回到主堡；這裡只看這個地方的成本。</p>
    </div>
  );
}

function CollectionList({ items, title = "收款紀錄" }: { items: TownState["collections"]; title?: string }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed border-[#EADFCB] px-4 py-3 text-sm text-[#8C7B6B]">還沒有收款紀錄。</p>;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="divide-y divide-[#EADFCB]">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="text-[#8C7B6B]">{shortDate(c.date)}</span> {c.student} · {c.item}
              <span className="block text-xs text-[#8C7B6B]">{c.method === "cash" ? "現金" : "轉帳"}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">+${moneyText(c.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <OptionCard selected={value === "cash"} title="現金" hint="當面交給老闆" onSelect={() => onChange("cash")} />
      <OptionCard selected={value === "transfer"} title="轉帳" hint="轉到老闆的帳戶" onSelect={() => onChange("transfer")} />
    </div>
  );
}

/** 送回主堡：金額預設帶入背包全部（style doc §4.2）。 */
export function RemitForm({
  member,
  holding,
  onSubmit,
  onClose,
}: {
  member: MemberId;
  holding: number;
  onSubmit: (input: { amount: number; method: PayMethod; ref?: string; note?: string; date: string }) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(holding));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const value = Number(amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = remitAmountError(value, holding);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit({ amount: value, method, ref: method === "transfer" && ref ? ref : undefined, note: note.trim() || undefined, date });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PanelHeader
        icon={<KiwiAvatar scarf={memberOf(member).scarf} accessory="pack" size={48} />}
        title="送回主堡"
        sub={
          <>
            背包裡有 <b className="tabular-nums text-[#4D4239]">${moneyText(holding)}</b>
          </>
        }
        onClose={onClose}
      />
      <div className="flex items-start gap-2">
        <Field
          label="送多少"
          className="flex-1"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^\d]/g, ""));
            setError(null);
          }}
          error={error ?? undefined}
        />
        <Button type="button" variant="secondary" className="mt-[26px] h-12" onClick={() => setAmount(String(holding))}>
          全部
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-900">怎麼給老闆</span>
        <MethodPicker value={method} onChange={setMethod} />
      </div>
      <div className={cn("grid gap-3", method === "transfer" && "grid-cols-2")}>
        {method === "transfer" && (
          <Field label="末五碼" hint="（選填）" inputMode="numeric" maxLength={5} value={ref} onChange={(e) => setRef(e.target.value.replace(/[^\d]/g, ""))} placeholder="38211" />
        )}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={dateId}>日期</FieldLabel>
          <input id={dateId} type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value || TODAY)} className={cn(fieldControlClass(false), "h-12")} />
        </div>
      </div>
      <Field label="備註" hint="（選填）" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：連同上次的零錢" />
      <Button type="submit" size="lg">
        <CartIcon className="size-6 shrink-0" />
        出發！送 ${moneyText(Number.isFinite(value) ? value : 0)} 到主堡
      </Button>
      <p className="text-center text-xs leading-relaxed text-[#8C7B6B]">
        老闆按「收到了」才算入庫，送出後他會收到通知。
        <br />
        確認前你都可以撤回。
      </p>
    </form>
  );
}

/** 老闆記一筆：主堡付出去的錢，或自己補錢進主堡（借給公司）。 */
export function ExpenseForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: { category: EntryCategory; amount: number; payee?: string; note: string; place?: Place }) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "loan">("expense");
  const [category, setCategory] = useState<Exclude<EntryCategory, "loan">>("party");
  const [place, setPlace] = useState<Place>("tainan");
  const needsPlace = kind === "expense" && PLACE_CATEGORIES.includes(category);
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; note?: string }>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    const next = {
      amount: value > 0 ? undefined : "請輸入金額",
      note: note.trim() ? undefined : "寫一下這筆是什麼",
    };
    setErrors(next);
    if (next.amount || next.note) return;
    onSubmit({ category: kind === "loan" ? "loan" : category, amount: value, payee: payee.trim() || undefined, note: note.trim(), place: needsPlace ? place : undefined });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PanelHeader icon={<KeepBadge />} title="記一筆" sub="只有老闆能記；大家都看得到帳本" onClose={onClose} />
      <SegmentedTabs<"expense" | "loan">
        ariaLabel="記哪一種"
        fill
        value={kind}
        onChange={setKind}
        options={[
          { value: "expense", label: "主堡付出去" },
          { value: "loan", label: "老闆補錢（借給公司）" },
        ]}
      />
      {kind === "expense" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">分類</span>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <FilterChip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                {c.label}
              </FilterChip>
            ))}
          </div>
          <p className="text-xs text-[#8C7B6B]">場地費、助教費、發薪從「待發」扣；Party／公共、其他從「水庫基金」扣。</p>
        </div>
      )}
      {needsPlace && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">哪個地方</span>
          <SegmentedTabs<Place>
            ariaLabel="哪個地方"
            fill
            value={place}
            onChange={setPlace}
            options={[
              { value: "tainan", label: PLACES.tainan.name },
              { value: "kaohsiung", label: PLACES.kaohsiung.name },
            ]}
          />
        </div>
      )}
      <Field label="金額" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} error={errors.amount} placeholder="1200" />
      {kind === "expense" && <Field label="付給誰" hint="（選填）" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="例如：丁丁、高雄房東" />}
      <Field label="說明" value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} placeholder={kind === "loan" ? "例如：先補 11 月的場租" : "例如：萬聖節 Party 酒水"} />
      <Button type="submit" size="lg">
        記下來
      </Button>
      {kind === "loan" && <p className="text-center text-xs text-[#8C7B6B]">補進來的錢算「借給公司」，只記帳、不排還款；建城貸款會跟著變多。</p>}
    </form>
  );
}

const PRESETS = [
  { item: "一般課卡 6 堂", amount: 2000 },
  { item: "一般課卡 12 堂", amount: 3800 },
  { item: "進階單堂", amount: 350 },
] as const;

/** 示意工具：假裝有學生付錢（之後是課卡頁的「確認收款」）。 */
export function CollectForm({ onSubmit, onClose }: { onSubmit: (input: { receiverId: MemberId; student: string; item: string; amount: number; method: PayMethod }) => void; onClose: () => void }) {
  const [receiverId, setReceiverId] = useState<MemberId>("dd");
  const [preset, setPreset] = useState(0);
  const [student, setStudent] = useState("新同學");
  const [method, setMethod] = useState<PayMethod>("cash");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = PRESETS[preset];
    onSubmit({ receiverId, student: student.trim() || "新同學", item: p.item, amount: p.amount, method });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PanelHeader icon={<CoinIcon size={44} />} title="模擬：學生付錢" sub="示意用，正式版是課卡頁的「確認收款」" onClose={onClose} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-900">付給誰</span>
        <SegmentedTabs<MemberId> ariaLabel="付給誰" fill value={receiverId} onChange={setReceiverId} options={MEMBERS.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-900">買什麼</span>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p, i) => (
            <OptionCard key={p.item} selected={preset === i} title={`$${moneyText(p.amount)}`} hint={p.item} onSelect={() => setPreset(i)} />
          ))}
        </div>
      </div>
      <Field label="學生" value={student} onChange={(e) => setStudent(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-900">怎麼付</span>
        <MethodPicker value={method} onChange={setMethod} />
      </div>
      <Button type="submit" size="lg">
        學生付錢了
      </Button>
    </form>
  );
}

const LEGEND: [ReactNode, string, string][] = [
  [<KeepIcon key="k" size={30} />, "主堡", "大水庫，公司的錢，老闆保管。倉庫 1 箱 ≈ $1,000，準確數字看上面"],
  [<KiwiAvatar key="b" scarf="#4BB38B" accessory="pack" size={34} />, "背包", "代收：學生付給這個人、還沒交回主堡的錢"],
  [<CourierAvatar key="c" size={34} />, "推車＋！", "送出、等老闆確認的錢；沙漏條是等了幾天"],
  [<KiwiAvatar key="s" scarf="#7FA8E0" accessory="sack" bg="#EAF1FB" size={34} />, "冒煙", `手上的錢放超過 ${SETTINGS.overdueDays} 天沒繳`],
  [<KiwiAvatar key="o" scarf="#E58B7A" accessory="crown" bg="#FFF6D8" size={34} />, "皇冠", "營收負責人，只有他能按「收到了」、記主堡支出"],
  [<CrateIcon key="f" tone="fund" size={30} />, "水庫基金", "扣掉預收、待發之後，公司真正能用的錢"],
  [<HammerIcon key="h" size={30} />, "建城貸款", "老闆前期投入、之後補的錢，只記帳不排還款"],
];

export function LegendPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader icon={<KeepBadge />} title="這些圖代表什麼" sub="小鎮只是把帳畫出來；對帳請用帳本模式" onClose={onClose} />
      <ul className="flex flex-col gap-3">
        {LEGEND.map(([icon, title, text]) => (
          <li key={title} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center">{icon}</span>
            <span>
              <b className="text-sm">{title}</b>
              <span className="block text-[13px] text-[#8C7B6B]">{text}</span>
            </span>
          </li>
        ))}
        <li className="text-[13px] text-[#8C7B6B]">河的兩岸是台南、高雄，只放人和教室，不各自存錢；錢只有主堡一個庫。點房子、教室看場地規則和場地費。</li>
      </ul>
    </div>
  );
}
