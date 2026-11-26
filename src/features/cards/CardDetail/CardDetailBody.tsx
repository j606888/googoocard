"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Ellipsis, Pencil, Search, Trash2 } from "lucide-react";
import {
  Card,
  CardDetail,
  useDeleteCardMutation,
  useEnableCardMutation,
  useExpireCardMutation,
} from "@/store/slices/cards";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { studentDetailHref } from "@/lib/studentNav";
import CardSerial from "@/components/CardSerial";
import ConfirmDialog from "@/components/ConfirmDialog";
import DanceStyleDot from "@/components/DanceStyleDot";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import MenuItem from "@/components/MenuItem";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cardKind,
  DEFAULT_HOLDER_SORT,
  HOLDER_SORT_OPTIONS,
  HolderSort,
  isRunningOut,
  perSessionPrice,
  sortHolders,
} from "../cardInsights";
import { CardKindBadge } from "../CardKindBadge";

type HolderFilter = "all" | "runningOut" | "unpaid";

/** 只有複習卡／體驗課掛標籤（一般方案佔大多數，不標）；說明收在 ⓘ 裡。 */
const KIND_INFO = {
  practice: { label: "複習卡", explain: "複習卡：有這個舞種資格的學生才買得到。" },
  trial: { label: "體驗課", explain: "體驗課：老師在課程頁的體驗名單登記時用，學生自助簽到買不到。" },
} as const;

/** 已發出的卡裡跟現在價格不同的那幾張，例：「有 3 張是舊價 $3,600」。 */
const oldPriceText = (issuedPrices: CardDetail["issuedPrices"], currentPrice: number): string | null => {
  const old = issuedPrices.filter(({ price }) => price !== currentPrice);
  if (old.length === 0) return null;
  return `有 ${old
    .map(({ price, count }, index) => `${count} 張是${index === 0 ? "舊價 " : ""}$${price.toLocaleString()}`)
    .join("、")}`;
};

/** 詳情 API 的形狀轉回列表的 `Card`，給編輯／複製表單當起點。 */
export const cardFromDetail = (detail: CardDetail): Card => ({
  ...detail.card,
  expiredAt: detail.card.expiredAt ? new Date(detail.card.expiredAt) : null,
  purchasedCount: detail.purchasedCount,
  activeHolders: detail.activeHolderCount,
  totalRevenue: detail.totalRevenue,
});

/**
 * 一個課卡方案的詳情：開放購買開關、價格與累積賣出、編輯／⋯（複製、刪除）、持卡學生。
 * 桌面在右側抽屜裡、手機是整頁，兩邊渲染同一份。去框線：價格是大字＋一行說明，不包底色塊。
 */
const CardDetailBody = ({
  detail,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  detail: CardDetail;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeleted: () => void;
}) => {
  const { card, purchasedCount, activeHolderCount, totalRevenue, issuedPrices, holders } = detail;
  const kind = cardKind(card);
  const kindInfo = kind === "general" ? null : KIND_INFO[kind];
  const oldPrices = oldPriceText(issuedPrices, card.price);
  const [moreOpen, setMoreOpen] = useState(false);
  const isOpen = !card.expiredAt;
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expireCard, { isLoading: isExpiring }] = useExpireCardMutation();
  const [enableCard, { isLoading: isEnabling }] = useEnableCardMutation();
  const [deleteCard, { isLoading: isDeleting }] = useDeleteCardMutation();

  const toggleOpen = async () => {
    if (isOpen) {
      setConfirmArchive(true);
      return;
    }
    await enableCard(card.id);
  };

  const handleDelete = async () => {
    await deleteCard(card.id);
    setConfirmDelete(false);
    onDeleted();
  };

  const priceMeta = [
    card.sessions !== 1 ? `每堂 $${formatMoney(perSessionPrice(card))}` : null,
    `累積賣出 ${purchasedCount} 張`,
    `共 $${formatMoney(totalRevenue)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="break-words text-[22px] font-semibold text-ink">{card.name}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <DanceStyleDot style={card.danceStyle} />
              {card.danceStyle?.name ?? "不限舞種"}
            </span>
            {kindInfo && (
              <span className="inline-flex items-center">
                <CardKindBadge kind={kind} label={kindInfo.label} />
                <InfoTip label={`${kindInfo.label}說明`}>{kindInfo.explain}</InfoTip>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOpen}
          aria-label="開放購買"
          disabled={isEnabling}
          onClick={toggleOpen}
          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-1 text-[13px] text-ink-2 outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 disabled:opacity-50"
        >
          {isOpen ? "開放購買" : "已下架"}
          <span
            className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
              isOpen ? "bg-primary-700" : "bg-neutral-300"
            }`}
          >
            <span
              className={`size-5 rounded-full bg-white shadow-sm transition-transform ${
                isOpen ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {confirmArchive && (
        <div className="mt-4 flex flex-col gap-2.5 rounded-xl bg-warning-100 px-4 py-3 text-warning-950">
          <p className="text-sm leading-relaxed">
            下架「{card.name}」？學生之後買不到這個方案；手上還有的 {activeHolderCount}{" "}
            張照常使用。
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              isLoading={isExpiring}
              onClick={async () => {
                await expireCard(card.id);
                setConfirmArchive(false);
              }}
            >
              下架
            </Button>
            <Button variant="text" size="sm" onClick={() => setConfirmArchive(false)}>
              先不要
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold tabular-nums tracking-tight text-ink">
            ${formatMoney(card.price)}
          </span>
          <span className="text-[15px] tabular-nums text-ink-2">{card.sessions} 堂</span>
          {oldPrices && (
            <InfoTip label="已發出的卡的價格" className="self-center">
              已發出的卡，用的是當時的價格。{oldPrices}。
            </InfoTip>
          )}
        </div>
        <p className="text-[13px] tabular-nums text-ink-3">{priceMeta}</p>
      </div>

      <div className="mt-3 -ml-2 flex items-center gap-1">
        <Button variant="text" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          編輯
        </Button>
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="更多動作" className="text-ink-2">
              <Ellipsis className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1.5">
            <MenuItem
              icon={<Copy className="size-4" aria-hidden />}
              onClick={() => {
                setMoreOpen(false);
                onDuplicate();
              }}
            >
              複製成新方案
            </MenuItem>
            <MenuItem
              danger
              disabled={purchasedCount > 0}
              hint={purchasedCount > 0 ? "賣出過的方案不能刪，可以下架" : undefined}
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={() => {
                setMoreOpen(false);
                setConfirmDelete(true);
              }}
            >
              刪除
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>

      <div aria-hidden className="-mx-5 my-6 h-2 bg-band lg:hidden" />
      <div className="hidden lg:block lg:h-8" aria-hidden />

      <Holders holders={holders} isTrial={kind === "trial"} cardId={card.id} />

      <ConfirmDialog
        variant="danger"
        open={confirmDelete}
        title="刪除這個方案？"
        message={`「${card.name}」會直接刪掉，不會留在「已下架」。`}
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

const Holders = ({
  holders,
  isTrial,
  cardId,
}: {
  holders: CardDetail["holders"];
  isTrial: boolean;
  cardId: number;
}) => {
  const [filter, setFilter] = useState<HolderFilter>("all");
  const [sort, setSort] = useState<HolderSort>(DEFAULT_HOLDER_SORT);
  const [query, setQuery] = useState("");

  const runningOut = holders.filter(isRunningOut).length;
  const unpaid = holders.filter((h) => !h.isPaid).length;

  const visible = useMemo(() => {
    const trimmed = query.trim();
    const filtered = holders.filter((h) => {
      if (trimmed && !h.student.name.includes(trimmed)) return false;
      if (filter === "runningOut") return isRunningOut(h);
      if (filter === "unpaid") return !h.isPaid;
      return true;
    });
    return sortHolders(filtered, sort);
  }, [holders, query, sort, filter]);

  // 只列有人的篩選；快用完、未付款都沒人時整排不放。
  const filters: { value: HolderFilter; label: string; hint: number }[] = [
    { value: "all" as const, label: "全部", hint: holders.length },
    { value: "runningOut" as const, label: "快用完", hint: runningOut },
    { value: "unpaid" as const, label: "未付款", hint: unpaid },
  ].filter((option) => option.value === "all" || option.hint > 0);

  const emptyText =
    holders.length === 0
      ? isTrial
        ? "體驗課卡當堂就用掉，通常不會有人「持卡中」。"
        : "目前沒有人手上有這張卡。"
      : filter === "runningOut"
        ? "沒有快用完的人。"
        : filter === "unpaid"
          ? "款項都收齊了。"
          : "找不到符合的學生。";

  return (
    <section aria-labelledby={`card-holders-${cardId}`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`card-holders-${cardId}`} className="text-[17px] font-semibold text-ink">
          持卡中的學生
        </h3>
        <span className="text-[13px] tabular-nums text-ink-3">{holders.length} 位</span>
      </div>
      {(filters.length > 1 || holders.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {filters.length > 1 && (
            <SegmentedTabs ariaLabel="持卡學生篩選" value={filter} onChange={setFilter} options={filters} />
          )}
          {holders.length > 1 && (
            <Select
              size="plain"
              aria-label="排序"
              className="w-auto"
              value={sort}
              onChange={setSort}
              options={HOLDER_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          )}
        </div>
      )}
      {holders.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋學生姓名"
            aria-label="搜尋學生姓名"
            className="h-11 w-full rounded-lg bg-band pr-3 pl-10 text-[15px] text-ink outline-none placeholder:text-ink-3 focus-visible:ring-[3px] focus-visible:ring-primary-300 lg:text-sm"
          />
        </div>
      )}
      {visible.length === 0 ? (
        holders.length === 0 ? (
          <EmptyState kind="inline" title={emptyText} />
        ) : (
          <EmptyState
            kind="filtered"
            title={emptyText}
            action={
              <Button
                variant="text"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                清除篩選
              </Button>
            }
          />
        )
      ) : (
        <ul className="divide-y divide-line border-b border-line">
          {visible.map((holder) => {
            const low = isRunningOut(holder);
            return (
              <li key={holder.id}>
                <Link
                  href={studentDetailHref(holder.studentId, `/cards/${cardId}`)}
                  className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-primary-50"
                >
                  <img
                    src={holder.student.avatarUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-medium text-ink">{holder.student.name}</span>
                      <CardSerial serialNumber={holder.serialNumber} />
                    </span>
                    <span className="truncate text-[13px] tabular-nums text-ink-3">
                      {formatDate(holder.createdAt, "M/d")} 購買
                      {!holder.isPaid && <span className="font-semibold text-warning-800"> · 未付款</span>}
                      {low && <span className="font-semibold text-warning-800"> · 快用完</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className={`text-[15px] font-semibold ${low ? "text-warning-800" : "text-ink"}`}>
                      剩 {holder.remainingSessions}
                    </span>
                    <span className="text-[13px] text-ink-3"> / {holder.totalSessions} 堂</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/** `CardDetailBody` while the detail loads — same blocks, data skeleton-ed. */
export const CardDetailSkeleton = () => (
  <div className="flex flex-col" aria-busy="true">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="mt-2.5 h-6 w-11 shrink-0" />
    </div>
    <div className="mt-5 flex flex-col gap-2">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3.5 w-52" />
    </div>
    <Skeleton className="mt-4 h-5 w-20" />
    <div aria-hidden className="-mx-5 my-6 h-2 bg-band lg:hidden" />
    <div className="hidden lg:block lg:h-8" aria-hidden />
    <h3 className="text-[17px] font-semibold text-ink">持卡中的學生</h3>
    <div className="mt-3 divide-y divide-line">
      {["w-24", "w-16", "w-20"].map((width, i) => (
        <div key={i} className={`flex min-h-14 items-center gap-3 py-2 ${i === 2 ? "opacity-50" : ""}`}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={`h-3.5 ${width}`} />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  </div>
);

export default CardDetailBody;
