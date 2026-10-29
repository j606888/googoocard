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
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { cn, formatDate } from "@/lib/utils";
import SortMenu from "@/components/SortMenu";
import { studentDetailHref } from "@/lib/studentNav";
import CardSerial from "@/components/CardSerial";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import FilterChip from "@/components/FilterChip";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import MenuItem from "@/components/MenuItem";
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
 * 桌面在右側抽屜裡、手機是整頁，兩邊渲染同一份。
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h2 className="text-2xl font-bold text-neutral-900 break-words">{card.name}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={`size-2 rounded-full ${card.danceStyle ? danceStyleMeta(card.danceStyle).dot : "bg-neutral-400"}`}
              />
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
          className="shrink-0 flex items-center gap-2 min-h-11 px-1 text-[13px] text-neutral-700 cursor-pointer disabled:opacity-50"
        >
          {isOpen ? "開放購買" : "已下架"}
          <span
            className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
              isOpen ? "bg-primary-700" : "bg-neutral-300"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isOpen ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {confirmArchive && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning-300 bg-warning-50 p-4">
          <p className="text-sm leading-relaxed text-warning-950">
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
            <Button variant="ghost" size="sm" className="bg-white" onClick={() => setConfirmArchive(false)}>
              先不要
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl bg-neutral-50 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">${card.price.toLocaleString()}</span>
            <span className="text-sm text-neutral-500">/ {card.sessions} 堂</span>
            {oldPrices && (
              <InfoTip label="已發出的卡的價格" className="self-center">
                已發出的卡，用的是當時的價格。{oldPrices}。
              </InfoTip>
            )}
          </div>
          {card.sessions !== 1 && (
            <span className="text-sm font-semibold text-primary-900">
              單堂 ${perSessionPrice(card).toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-[13px] text-neutral-500">
          累積賣出 {purchasedCount} 張 · ${totalRevenue.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onEdit} className="flex-1">
          <Pencil className="size-4" />
          編輯
        </Button>
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="更多動作" className="border-neutral-300 text-neutral-700">
              <Ellipsis className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
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
  const chips: { value: HolderFilter; label: string; count: number }[] = [
    { value: "all" as const, label: "全部", count: holders.length },
    { value: "runningOut" as const, label: "快用完", count: runningOut },
    { value: "unpaid" as const, label: "未付款", count: unpaid },
  ].filter((chip) => chip.value === "all" || chip.count > 0);

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
    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          持卡中的學生 <span className="font-medium text-neutral-500">{holders.length}</span>
        </h3>
        {holders.length > 1 && <SortMenu sort={sort} options={HOLDER_SORT_OPTIONS} onChange={setSort} />}
      </div>
      {chips.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <FilterChip
              key={chip.value}
              active={filter === chip.value}
              count={chip.count}
              onClick={() => setFilter(chip.value)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
      )}
      {holders.length > 8 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋學生姓名"
            aria-label="搜尋學生姓名"
            className={cn(fieldControlClass(), "h-11 pl-10")}
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
                variant="secondary"
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
        <ul className="flex flex-col">
          {visible.map((holder) => {
            const low = isRunningOut(holder);
            return (
              <li key={holder.id}>
                <Link
                  href={studentDetailHref(holder.studentId, `/cards/${cardId}`)}
                  className="flex items-center gap-3 py-2.5 border-b border-neutral-100 hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
                >
                  <img
                    src={holder.student.avatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[15px]">
                      <span className="font-semibold truncate">{holder.student.name}</span>
                      <CardSerial serialNumber={holder.serialNumber} />
                      {!holder.isPaid && <StatusTag tone="danger">未付款</StatusTag>}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatDate(holder.createdAt, "M/d")} 購買
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`text-[17px] font-bold ${low ? "text-warning-950" : "text-neutral-900"}`}>
                      {holder.remainingSessions}
                    </span>
                    <span className="text-[13px] text-neutral-500"> / {holder.totalSessions}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/** `CardDetailBody` while the detail loads — same blocks, data skeleton-ed. */
export const CardDetailSkeleton = () => (
  <div className="flex flex-col gap-5" aria-busy="true">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="h-6 w-11 shrink-0 mt-2.5" />
    </div>
    <Skeleton className="h-[96px] w-full rounded-2xl" />
    <div className="flex gap-2">
      <Skeleton className="h-11 flex-1 rounded-xl" />
      <Skeleton className="size-11 rounded-xl" />
    </div>
    <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
      <h3 className="text-base font-bold">持卡中的學生</h3>
      {["w-24", "w-16", "w-20"].map((width, i) => (
        <div key={i} className={`flex items-center gap-3 py-2.5 ${i === 2 ? "opacity-50" : ""}`}>
          <Skeleton className="size-9 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={`h-3.5 ${width}`} />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-10" />
        </div>
      ))}
    </div>
  </div>
);

export default CardDetailBody;
