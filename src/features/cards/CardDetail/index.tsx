"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CardDetail as CardDetailType } from "@/store/slices/cards";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { formatDate } from "@/lib/utils";
import { ArrowLeftIcon, ArrowUpDown, Search, Users } from "lucide-react";

type SortOrder = "newest" | "oldest";

const CardDetail = ({ detail }: { detail: CardDetailType }) => {
  const { card, purchasedCount, activeHolderCount, totalRevenue, holders } = detail;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");

  const visibleHolders = useMemo(() => {
    const filtered = query.trim()
      ? holders.filter((h) => h.student.name.includes(query.trim()))
      : holders;
    // API returns newest-first (createdAt desc); reverse for oldest-first.
    return sort === "newest" ? filtered : [...filtered].reverse();
  }, [holders, query, sort]);

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      {/* Desktop back link */}
      <Link
        href="/cards"
        className="hidden lg:inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Cards
      </Link>

      {/* Title + badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <h2 className="text-2xl font-semibold">{card.name}</h2>
        {card.isPracticeCard && (
          <span className="text-xs text-warning-900 bg-warning-100 border border-warning-300 rounded-full px-2.5 py-0.5">
            Practice Card
          </span>
        )}
        {card.danceType && (
          <span className={`text-xs rounded-full px-2.5 py-0.5 ${DANCE_TYPE_META[card.danceType].badge}`}>
            {danceTypeLabel(card.danceType)}
          </span>
        )}
        {card.expiredAt && (
          <span className="text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-2.5 py-0.5">
            已停用
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Summary label="購買人次" value={`${purchasedCount}`} />
        <Summary label="尚未用完" value={`${activeHolderCount}`} highlight />
        <Summary label="總收入" value={`$${totalRevenue.toLocaleString()}`} />
      </div>

      {/* Holders header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-600 flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          未用完的持卡人 ({visibleHolders.length})
        </h3>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 cursor-pointer"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sort === "newest" ? "購買由新到舊" : "購買由舊到新"}
        </button>
      </div>

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
        <div className="flex flex-col items-center justify-center p-8 gap-1 bg-neutral-50 rounded-xl">
          <p className="text-base font-semibold text-neutral-700">
            {holders.length === 0 ? "目前沒有未用完的卡" : "找不到符合的學生"}
          </p>
          <p className="text-sm text-neutral-500 text-center">
            {holders.length === 0
              ? "這張卡的持卡人都已用完或已停用。"
              : "換個關鍵字再試試。"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          {visibleHolders.map((holder) => {
            const used = holder.totalSessions - holder.remainingSessions;
            const progress =
              holder.totalSessions > 0
                ? Math.min(100, Math.round((used / holder.totalSessions) * 100))
                : 0;
            return (
              <Link
                key={holder.id}
                href={`/students/${holder.studentId}?from=cards`}
                className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white hover:shadow-md hover:border-neutral-300 transition-all"
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
                    {!holder.isPaid && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-danger-100 text-danger-700">
                        未付款
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    購買日 {formatDate(holder.createdAt)}
                  </p>
                </div>
                <div className="text-right leading-none shrink-0">
                  <div className="flex items-baseline gap-0.5 justify-end">
                    <span className="text-xl font-bold text-primary-600">
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
