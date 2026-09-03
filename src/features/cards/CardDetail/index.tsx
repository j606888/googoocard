"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CardDetail as CardDetailType,
  useEnableCardMutation,
  useExpireCardMutation,
} from "@/store/slices/cards";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { formatDate } from "@/lib/utils";
import { ArrowLeftIcon, Ban, Lightbulb, Pencil, Search, Users } from "lucide-react";
import SortMenu from "@/components/SortMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditCard from "../CardList/EditCard";
import {
  DEFAULT_HOLDER_SORT,
  HOLDER_SORT_OPTIONS,
  HolderSort,
  isRunningOut,
  perSessionPrice,
  sortHolders,
} from "../cardInsights";

type HolderFilter = "all" | "runningOut" | "unpaid";

const CardDetail = ({ detail }: { detail: CardDetailType }) => {
  const { card, purchasedCount, activeHolderCount, totalRevenue, holders } = detail;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<HolderSort>(DEFAULT_HOLDER_SORT);
  const [filter, setFilter] = useState<HolderFilter>("all");
  const [editing, setEditing] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [expireCard, { isLoading: isExpiring }] = useExpireCardMutation();
  const [enableCard] = useEnableCardMutation();

  const isDisabled = !!card.expiredAt;

  const runningOutCount = holders.filter(isRunningOut).length;
  const unpaidCount = holders.filter((h) => !h.isPaid).length;

  const visibleHolders = useMemo(() => {
    const trimmed = query.trim();
    const filtered = holders.filter((h) => {
      if (trimmed && !h.student.name.includes(trimmed)) return false;
      if (filter === "runningOut") return isRunningOut(h);
      if (filter === "unpaid") return !h.isPaid;
      return true;
    });
    return sortHolders(filtered, sort);
  }, [holders, query, sort, filter]);

  const handleExpire = async () => {
    await expireCard(card.id);
    setConfirmDisable(false);
  };

  const filterChips: { value: HolderFilter; label: string; count: number; activeClass: string }[] =
    [
      { value: "all", label: "全部", count: holders.length, activeClass: "bg-neutral-800 text-white" },
      {
        value: "runningOut",
        label: "快用完",
        count: runningOutCount,
        activeClass: "bg-warning-100 text-warning-900 border-warning-300",
      },
      {
        value: "unpaid",
        label: "未付款",
        count: unpaidCount,
        activeClass: "bg-danger-100 text-danger-700 border-danger-200",
      },
    ];

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      {/* Desktop back link */}
      <Link
        href="/cards"
        className="hidden lg:inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        課卡
      </Link>

      {/* Title + badges + actions */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h2 className="text-2xl font-semibold">{card.name}</h2>
          {card.isPracticeCard ? (
            <span className="text-xs text-warning-900 bg-warning-100 border border-warning-300 rounded-full px-2.5 py-0.5">
              複習卡
            </span>
          ) : (
            <span className="text-xs text-neutral-600 bg-neutral-100 rounded-full px-2.5 py-0.5">
              一般卡
            </span>
          )}
          {card.danceType && (
            <span className={`text-xs rounded-full px-2.5 py-0.5 ${DANCE_TYPE_META[card.danceType].badge}`}>
              {danceTypeLabel(card.danceType)}
            </span>
          )}
          {isDisabled && (
            <span className="text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-2.5 py-0.5">
              已停用
            </span>
          )}
          <span className="text-[13px] text-neutral-400">
            ${card.price.toLocaleString()} / {card.sessions} 堂 · 單堂 $
            {perSessionPrice(card).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isDisabled && (
            <>
              <ActionButton icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(true)}>
                編輯
              </ActionButton>
              <ActionButton icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setConfirmDisable(true)}>
                停用
              </ActionButton>
            </>
          )}
          {isDisabled && (
            <ActionButton
              icon={<Lightbulb className="w-3.5 h-3.5" />}
              onClick={() => enableCard(card.id)}
            >
              啟用
            </ActionButton>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Summary label="累積售出" value={`${purchasedCount}`} />
        <Summary label="持卡中" value={`${activeHolderCount}`} highlight />
        <Summary label="累積收入" value={`$${totalRevenue.toLocaleString()}`} />
      </div>

      {/* Holders header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          持卡中的學生 ({visibleHolders.length})
        </h3>
        <SortMenu sort={sort} options={HOLDER_SORT_OPTIONS} onChange={setSort} />
      </div>

      {/* Quick filters */}
      {holders.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                filter === chip.value
                  ? chip.activeClass
                  : "bg-neutral-100 border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {chip.label} {chip.count}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {holders.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋學生姓名"
            className="w-full pl-9 pr-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
      )}

      {/* Holder list */}
      {visibleHolders.length === 0 ? (
        <EmptyHolders hasHolders={holders.length > 0} filter={filter} />
      ) : (
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          {visibleHolders.map((holder) => {
            const used = holder.totalSessions - holder.remainingSessions;
            // 進度條畫的是「還剩多少」——條越短越急。
            const remainingPct =
              holder.totalSessions > 0
                ? Math.max(
                    0,
                    Math.min(100, Math.round((holder.remainingSessions / holder.totalSessions) * 100))
                  )
                : 0;
            const runningOut = isRunningOut(holder);
            return (
              <Link
                key={holder.id}
                href={`/students/${holder.studentId}?from=cards`}
                className={`flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all ${
                  runningOut
                    ? "border-warning-300 bg-warning-50 hover:border-warning-400"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <img
                  src={holder.student.avatarUrl}
                  alt={holder.student.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 truncate">
                      {holder.student.name}
                    </span>
                    {runningOut && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-warning-100 text-warning-900">
                        快用完
                      </span>
                    )}
                    {!holder.isPaid && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-danger-100 text-danger-700">
                        未付款
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${runningOut ? "bg-warning-500" : "bg-primary-500"}`}
                      style={{ width: `${remainingPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {formatDate(holder.createdAt, "M/d")} 購買 · 已上 {used} 堂
                  </p>
                </div>
                <div className="text-right leading-none shrink-0">
                  <div className="flex items-baseline gap-0.5 justify-end">
                    <span
                      className={`text-xl font-bold ${
                        runningOut ? "text-warning-700" : "text-primary-600"
                      }`}
                    >
                      {holder.remainingSessions}
                    </span>
                    <span className="text-sm text-neutral-400">
                      /{holder.totalSessions}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">剩餘堂數</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {editing && <EditCard cardId={card.id} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmDisable}
        title="停用這張卡片？"
        message={`「${card.name}」之後無法再被購買，已發出的學生課卡不受影響。`}
        confirmLabel="停用"
        onConfirm={handleExpire}
        onCancel={() => setConfirmDisable(false)}
        isLoading={isExpiring}
      />
    </div>
  );
};

const ActionButton = ({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-600 border border-neutral-200 rounded-full px-4 py-2 hover:border-primary-300 hover:text-neutral-800 transition-colors cursor-pointer"
  >
    {icon}
    {children}
  </button>
);

const EmptyHolders = ({
  hasHolders,
  filter,
}: {
  hasHolders: boolean;
  filter: HolderFilter;
}) => {
  const [title, hint] = !hasHolders
    ? ["目前沒有未用完的卡", "這張卡的持卡人都已用完或已停用。"]
    : filter === "runningOut"
      ? ["沒有快用完的持卡人", "所有人的剩餘堂數都還夠。"]
      : filter === "unpaid"
        ? ["沒有未付款的持卡人", "這張卡的款項都收齊了。"]
        : ["找不到符合的學生", "換個關鍵字再試試。"];

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-1 bg-neutral-50 rounded-xl">
      <p className="text-base font-semibold text-neutral-700">{title}</p>
      <p className="text-sm text-neutral-500 text-center">{hint}</p>
    </div>
  );
};

const Summary = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="border border-neutral-100 bg-neutral-50 rounded-xl p-3 flex flex-col items-center">
    <p className={`text-xl font-bold ${highlight ? "text-primary-600" : "text-neutral-900"}`}>
      {value}
    </p>
    <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
  </div>
);

export default CardDetail;
