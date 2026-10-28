"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { cn } from "@/lib/utils";
import { daysSince } from "@/domains/finance/money";
import {
  useConfirmRemittanceMutation,
  useRejectRemittanceMutation,
  useWithdrawRemittanceMutation,
} from "@/store/slices/finance";
import { dayLabel, errorText } from "../format";
import { financeHref } from "../routes";
import { CartIcon, CoinIcon, CrateIcon, HammerIcon, KeepIcon } from "./icons";
import { KiwiAvatar } from "./sprites";
import { CONFIRM_LIMIT_DAYS, COURIER_SCARF, type TownCart, type TownView } from "./townView";

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const dollars = (n: number) => (n < 0 ? `−$${num(-n)}` : `$${num(n)}`);
const methodText = (c: TownCart) => (c.method === "CASH" ? "現金" : `轉帳${c.reference ? ` · 末五碼 ${c.reference}` : ""}`);

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
      <KiwiAvatar scarf={COURIER_SCARF} accessory="cap" bg="#FFFFFF" size={size} />
      <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-[#FFF4E4] bg-[#F4A23C] text-xs font-bold text-white">!</span>
    </span>
  );
}

/** 一筆等確認的繳回。營收負責人看得到「收到了／金額不對」；送的人自己看得到「撤回」。 */
function PendingItem({ cart, view, onConfirmed }: { cart: TownCart; view: TownView; onConfirmed: (id: number) => void }) {
  const [confirm, confirming] = useConfirmRemittanceMutation();
  const [reject, rejectingReq] = useRejectRemittanceMutation();
  const [withdraw, withdrawing] = useWithdrawRemittanceMutation();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const owner = view.viewer.isOwner;
  const ownerName = view.owner?.name ?? "營收負責人";
  const waited = daysSince(new Date(cart.createdAt));

  const onConfirm = async () => {
    try {
      onConfirmed(cart.id);
      await confirm(cart.id).unwrap();
      toast.success(`$${num(cart.amount)} 入庫了`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const submitReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("寫一下哪裡不對，對方才知道怎麼改");
    try {
      await reject({ id: cart.id, reason: reason.trim() }).unwrap();
      toast.success(`退回給${cart.fromName}了`);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const onWithdraw = async () => {
    try {
      await withdraw(cart.id).unwrap();
      toast.success("撤回了，錢回到你的背包");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-[18px] bg-[#FFF4E4] p-3">
      <div className="flex items-center gap-3">
        <CourierAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">
            {cart.fromName}送來 <span className="text-lg tabular-nums">${num(cart.amount)}</span>
          </p>
          <p className="text-[13px] text-[#B86A12]">
            {dayLabel(cart.sentOn)} · {methodText(cart)} · {waited === 0 ? "今天送的" : `等了 ${waited} 天`}
            {waited >= CONFIRM_LIMIT_DAYS && "，超過 3 天了"}
          </p>
          {cart.note && <p className="mt-0.5 text-[13px] text-[#8C7B6B]">備註：{cart.note}</p>}
        </div>
      </div>
      {owner && !rejecting && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onConfirm} isLoading={confirming.isLoading}>
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
            <Button type="submit" variant="dangerSecondary" className="flex-1" isLoading={rejectingReq.isLoading}>
              退回給{cart.fromName}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              取消
            </Button>
          </div>
        </form>
      )}
      {!owner && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-[#8C7B6B]">{ownerName}按「收到了」才算入庫。</p>
          {view.viewer.id === cart.fromId && (
            <Button size="sm" variant="secondary" onClick={onWithdraw} isLoading={withdrawing.isLoading}>
              撤回
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function KeepPanel({ view, onConfirmed, onClose }: { view: TownView; onConfirmed: (id: number) => void; onClose: () => void }) {
  const f = view.figures;
  const ownerName = view.owner?.name ?? "營收負責人";
  const parts = [
    { tone: "prepaid" as const, label: "預收", hint: `學生付了、還沒上的 ${f.prepaidSessions} 堂`, value: f.prepaid, color: "#D9D2C4" },
    { tone: "payable" as const, label: "其他", hint: "分帳上線後拆成待發（薪水、場地費）和水庫基金", value: f.other, color: "#F0B48A" },
  ];
  const positive = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader icon={<KeepBadge />} title="主堡" sub={`${ownerName}保管 · 公司的錢，不是${ownerName}的薪水`} onClose={onClose} />

      {view.carts.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="等確認">
          <h3 className="text-sm font-black">{view.viewer.isOwner ? `等你確認（${view.carts.length}）` : `等${ownerName}確認（${view.carts.length}）`}</h3>
          <ul className="flex flex-col gap-2">
            {view.carts.map((c) => (
              <PendingItem key={c.id} cart={c} view={view} onConfirmed={onConfirmed} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-3 rounded-[20px] bg-[#F6F1E6] px-4 py-3.5">
        <CoinIcon size={42} />
        <div className="flex-1">
          <p className="text-[12.5px] text-[#8C7B6B]">財庫裡</p>
          <p className={cn("text-[32px] font-semibold leading-tight tabular-nums", f.vault < 0 && "text-[#C4473A]")}>{dollars(f.vault)}</p>
        </div>
        <div className="text-right text-xs leading-relaxed text-[#8C7B6B]">
          還在路上 <b className="text-sm tabular-nums text-[#C2700F]">+{num(f.inTransit)}</b>
          <br />
          代收人手上 <b className="text-sm tabular-nums text-[#4D4239]">+{num(f.inHands)}</b>
          <br />
          公司的錢 <b className="text-sm tabular-nums text-[#4D4239]">{dollars(f.company)}</b>
        </div>
      </div>
      <p className="text-xs text-[#8C7B6B]">
        {view.owner?.name ?? "營收負責人"}自己收的課卡 {f.ownerCardCount} 張 ${num(f.ownerCollected)}，直接算進財庫。倉庫裡 1 箱 ≈ ${num(view.crates.unit)}，只是示意。
      </p>

      <section className="flex flex-col gap-2.5 border-t-2 border-dashed border-[#EADFCB] pt-4">
        <h3 className="text-sm font-black">這 {dollars(f.company)} 是誰的？</h3>
        <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.tone} style={{ width: `${(Math.max(0, p.value) / positive) * 100}%`, background: p.color }} />
          ))}
        </div>
        {parts.map((p) => (
          <div key={p.tone} className="flex items-center gap-2.5">
            <CrateIcon tone={p.tone} size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{p.label}</p>
              <p className="text-xs text-[#8C7B6B]">{p.hint}</p>
            </div>
            <span className={cn("text-lg font-semibold tabular-nums", p.value < 0 && "text-[#C4473A]")}>{dollars(p.value)}</span>
          </div>
        ))}
      </section>

      {f.ownerLoan !== null && (
        <section className="flex flex-col gap-2 border-t-2 border-dashed border-[#EADFCB] pt-4">
          <div className="flex items-center gap-2.5">
            <HammerIcon size={26} />
            <p className="flex-1 text-sm font-bold">建城貸款（欠{ownerName}的）</p>
            <span className="text-base font-semibold tabular-nums">${num(f.ownerLoan)}</span>
          </div>
          <div className="flex justify-between text-xs text-[#8C7B6B]">
            <span>只記帳、不排還款</span>
            <span>
              公司淨值 <b className={cn("tabular-nums", f.netWorth < 0 ? "text-[#C4473A]" : "text-primary-900")}>{dollars(f.netWorth)}</b>
            </span>
          </div>
        </section>
      )}

      <Link href={financeHref.vault} className="self-end text-sm font-bold text-primary-700 underline-offset-4 hover:underline">
        看主堡的進出明細 ›
      </Link>
    </div>
  );
}

export function PersonPanel({ view, userId, onRemit, onClose }: { view: TownView; userId: number; onRemit: () => void; onClose: () => void }) {
  const p = view.people.find((x) => x.id === userId);
  const isMe = view.viewer.id === userId;
  if (!p) {
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader icon={<KiwiAvatar scarf="#4BB38B" size={48} />} title={isMe ? "我的背包" : "背包"} sub="還沒收過錢" onClose={onClose} />
        <p className="text-sm text-[#8C7B6B]">課卡頁「確認收款」選你當收款人，收的錢就會出現在這裡。</p>
      </div>
    );
  }
  const myCarts = view.carts.filter((c) => c.fromId === userId);
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        icon={<KiwiAvatar scarf={p.scarf} accessory={p.inHand > 0 ? (p.overdue ? "sack" : "pack") : undefined} size={48} />}
        title={isMe ? "我的背包" : `${p.name}的背包`}
        sub={isMe ? "課卡頁「確認收款」選你收的錢，都在這裡" : "大家都看得到，只有本人能送回主堡"}
        onClose={onClose}
      />
      <div className="flex items-center gap-3 rounded-[20px] bg-[#FFF8EC] px-4 py-3">
        <CoinIcon size={40} />
        <div className="flex-1">
          <p className="text-[12.5px] text-[#8C7B6B]">手上還沒交</p>
          <p className="text-[30px] font-semibold leading-tight tabular-nums">${num(p.inHand)}</p>
        </div>
        {p.overdue && <span className="rounded-full bg-[#FBE1DC] px-2.5 py-1 text-xs font-bold text-[#C4473A]">{p.daysHeld} 天沒繳</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["收了", p.collected],
          ["路上", p.pending],
          ["已入庫", p.confirmed],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-[#F6F1E6] px-2 py-2">
            <p className="text-xs text-[#8C7B6B]">{label}</p>
            <p className="text-base font-semibold tabular-nums">${num(value as number)}</p>
          </div>
        ))}
      </div>
      {isMe && !view.viewer.isOwner && (
        <Button size="lg" onClick={onRemit} disabled={p.inHand <= 0}>
          <CartIcon className="size-6 shrink-0" />
          {p.inHand > 0 ? `送回主堡（$${num(p.inHand)}）` : "背包是空的"}
        </Button>
      )}
      {myCarts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-black">在路上</h3>
          <ul className="flex flex-col gap-2">
            {myCarts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-[18px] bg-[#FFF4E4] p-3">
                <CourierAvatar size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold tabular-nums">${num(c.amount)}</p>
                  <p className="text-[13px] text-[#B86A12]">
                    {dayLabel(c.sentOn)} · {methodText(c)} · 等{view.owner?.name ?? "營收負責人"}確認
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={financeHref.holder(userId)} className="self-end text-sm font-bold text-primary-700 underline-offset-4 hover:underline">
        看每一筆收款和繳回 ›
      </Link>
    </div>
  );
}

const LEGEND: [ReactNode, string, string][] = [
  [<KeepIcon key="k" size={36} />, "主堡", "大水庫：公司的錢，營收負責人保管。箱子是財庫的錢，只是示意"],
  [<KiwiAvatar key="p" scarf="#4BB38B" accessory="pack" size={40} />, "背包", "代收：學生付給這個人、還沒送回主堡的錢"],
  [<KiwiAvatar key="s" scarf="#7FA8E0" accessory="sack" bg="#EAF1FB" size={40} />, "冒煙、拎著錢袋", "超過設定的天數還沒送回"],
  [<CourierAvatar key="c" size={40} />, "推車和 ❗", "送出的繳回，停在主堡門口等確認；沙漏條是等了多久（滿格 3 天）"],
  [<KiwiAvatar key="o" scarf="#E58B7A" accessory="crown" bg="#FFF6D8" size={40} />, "皇冠", "營收負責人：只有他能按「收到了」"],
  [<HammerIcon key="h" size={32} />, "建城貸款", "老闆放進來的錢，只記帳、不排還款"],
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
        <li className="text-[13px] text-[#8C7B6B]">河的兩岸是教室的分部，只放人和教室，不各自存錢；錢只有主堡一個庫。</li>
      </ul>
    </div>
  );
}
