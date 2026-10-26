"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import SegmentedTabs from "@/components/SegmentedTabs";
import FilterChip from "@/components/FilterChip";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import CardListSkeleton from "./CardListSkeleton";
import CardSheet, { CardSheetView } from "../CardSheet";
import CardFormDrawer from "../CardForm/CardFormDrawer";
import type { CardFormTarget } from "../CardForm/useCardForm";
import { CardKindBadge } from "../CardKindBadge";
import {
  cardKind,
  cardsSummary,
  groupByDanceStyle,
  perSessionPrice,
  perSessionSavings,
} from "../cardInsights";

type Tab = "open" | "archived";
/** `"all"` 全部、數字 = 某個舞種、`"none"` = 不限舞種的方案。 */
type StyleFilter = "all" | "none" | number;

/** 桌面抽屜開著哪個方案，鏡射到網址（`?card=12`），重新整理或分享連結還是同一個。 */
const CARD_PARAM = "card";

const readCardParam = (): number | null => {
  const value = new URLSearchParams(window.location.search).get(CARD_PARAM);
  return value && /^\d+$/.test(value) ? Number(value) : null;
};

const writeCardParam = (id: number | null) => {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete(CARD_PARAM);
  else url.searchParams.set(CARD_PARAM, String(id));
  if (url.href !== window.location.href) window.history.replaceState(null, "", url);
};

/**
 * 課卡頁：一張依舞種分組的價目表。點方案才看得到詳情——桌面從右邊滑出抽屜
 * （背景調暗、列表還看得到），手機進整頁（`/cards/[id]`）。
 */
const CardList = () => {
  const { data, isLoading } = useGetCardsQuery();
  const { byId } = useDanceStyles();
  const isExpanded = useSizeClass() === "expanded";
  const [tab, setTab] = useState<Tab>("open");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  const [sheet, setSheetState] = useState<CardSheetView | null>(null);
  const [mobileForm, setMobileForm] = useState<CardFormTarget | null>(null);

  const setSheet = useCallback((view: CardSheetView | null) => {
    setSheetState(view);
    writeCardParam(view?.type === "detail" ? view.id : null);
  }, []);

  // 帶著 ?card= 進來（分享連結、桌面打開 /cards/[id] 被導回來）就直接打開那個方案。
  useEffect(() => {
    if (!isExpanded) return;
    const id = readCardParam();
    if (id !== null) setSheetState((prev) => prev ?? { type: "detail", id });
  }, [isExpanded]);

  if (isLoading || !data) return <CardListSkeleton />;

  const { activeCards, expiredCards } = data;
  const hasAnyCard = activeCards.length > 0 || expiredCards.length > 0;
  const summary = cardsSummary(activeCards);
  const styleOrder = [...byId.keys()];

  const tabCards = tab === "open" ? activeCards : expiredCards;
  const allGroups = groupByDanceStyle(tabCards, styleOrder);
  const groups = allGroups.filter(
    (group) =>
      styleFilter === "all" ||
      (styleFilter === "none" ? group.danceStyleId === null : group.danceStyleId === styleFilter)
  );
  // 抽屜的上一個／下一個照畫面上的順序走。
  const order = groups.flatMap((group) => group.cards.map((card) => card.id));

  const openCard = (card: Card) => (event: React.MouseEvent) => {
    // 手機走連結進整頁；桌面攔下來開抽屜（⌘／Ctrl 點擊還是照常開新分頁）。
    if (!isExpanded || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    setSheet({ type: "detail", id: card.id });
  };

  const newPlan = (danceStyleId?: number | null) => {
    const target: CardFormTarget = { mode: "new", danceStyleId };
    if (isExpanded) setSheet({ type: "form", target, returnTo: null });
    else setMobileForm(target);
  };

  const styleChips: { value: StyleFilter; label: string; dot: string }[] = [
    { value: "all", label: "全部舞種", dot: "" },
    ...allGroups.map((group) => {
      const style = group.danceStyleId !== null ? byId.get(group.danceStyleId) : undefined;
      return group.danceStyleId === null
        ? { value: "none" as const, label: "不限舞種", dot: "bg-neutral-400" }
        : { value: group.danceStyleId, label: style?.name ?? "舞種", dot: danceStyleMeta(style).dot };
    }),
  ];

  return (
    <div className="w-full max-w-[1080px] mx-auto px-5 py-4 lg:px-10 lg:py-10 flex flex-col gap-5 lg:gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-bold">課卡</h1>
          {hasAnyCard && (
            <p className="text-sm text-neutral-600">
              開放購買 {activeCards.length} 種方案・學生手上 {summary.activeStudentCards} 張還沒用完
            </p>
          )}
        </div>
        <Button onClick={() => newPlan()}>
          <Plus className="size-4" />
          新增方案
        </Button>
      </div>

      {!hasAnyCard ? (
        <EmptyState kind="page" title="還沒有課卡方案" description="建立第一個方案，學生就可以買了。" />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-neutral-200">
            <SegmentedTabs
              variant="underline"
              ariaLabel="方案狀態"
              value={tab}
              onChange={(next) => {
                setTab(next);
                setStyleFilter("all");
              }}
              options={[
                { value: "open", label: "開放購買", hint: activeCards.length },
                { value: "archived", label: "已下架", hint: expiredCards.length },
              ]}
            />
            {styleChips.length > 2 && (
              <div className="flex gap-2 pb-2 overflow-x-auto max-w-full [scrollbar-width:none]">
                {styleChips.map((chip) => (
                  <FilterChip
                    key={String(chip.value)}
                    active={styleFilter === chip.value}
                    onClick={() => setStyleFilter(chip.value)}
                  >
                    {chip.dot && <span aria-hidden="true" className={`w-2 h-2 rounded-full ${chip.dot}`} />}
                    {chip.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {tab === "archived" && (
            <p className="text-[13px] text-neutral-600 leading-relaxed">
              已下架的方案學生買不到，但已發出的卡照常扣堂。點開方案可以重新開放。
            </p>
          )}

          {groups.length === 0 && (
            <EmptyState
              kind="inline"
              title={tab === "archived" ? "沒有已下架的方案。" : "沒有開放購買的方案。"}
            />
          )}

          {groups.map((group) => {
            const style = group.danceStyleId !== null ? byId.get(group.danceStyleId) : undefined;
            const meta = danceStyleMeta(style);
            return (
              <section key={group.danceStyleId ?? "none"} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style ? meta.dot : "bg-neutral-400"}`} />
                    <h2 className="text-base font-bold truncate">{style?.name ?? "不限舞種"}</h2>
                    <span className="text-[13px] text-neutral-500 shrink-0">
                      {!style ? "任何舞種的課都能用" : style.hasLevels ? "分初階・中階・進階" : "不分級"}
                    </span>
                  </div>
                  {tab === "open" && (
                    <Button
                      variant="link"
                      onClick={() => newPlan(group.danceStyleId)}
                      className="min-h-9 text-[13px] font-semibold"
                    >
                      ＋ 加一個方案
                    </Button>
                  )}
                </div>
                <ul className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  {group.cards.map((card) => (
                    <CardRow
                      key={card.id}
                      card={card}
                      // 不限舞種那組常常混著私人課之類的不同產品，比單堂價沒意義。
                      savings={group.danceStyleId === null ? 0 : perSessionSavings(card, group.cards)}
                      selected={sheet?.type === "detail" && sheet.id === card.id}
                      onOpen={openCard(card)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}

      {isExpanded && (
        <CardSheet view={sheet} order={order} onChange={setSheet} onClose={() => setSheet(null)} />
      )}
      {!isExpanded && mobileForm && (
        <CardFormDrawer target={mobileForm} onClose={() => setMobileForm(null)} />
      )}
    </div>
  );
};

/**
 * 價目表的一列。單一元件樹：手機兩行（名稱／價格摘要），桌面攤成欄位——
 * 兩邊不同的只有幾個沒有狀態的文字片段（docs/ui-responsive.md 允許的 `hidden lg:`）。
 */
const CardRow = ({
  card,
  savings,
  selected,
  onOpen,
}: {
  card: Card;
  savings: number;
  selected: boolean;
  onOpen: (event: React.MouseEvent) => void;
}) => {
  const kind = cardKind(card);
  const perSession = perSessionPrice(card);
  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      <Link
        href={`/cards/${card.id}`}
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={`grid grid-cols-[minmax(0,1fr)_auto_16px] lg:grid-cols-[minmax(0,1fr)_64px_96px_128px_96px_16px] items-center gap-x-3 lg:gap-x-4 gap-y-1 px-4 lg:px-5 py-3.5 lg:py-4 transition-colors ${
          selected ? "bg-primary-50" : "hover:bg-neutral-50"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[15px] lg:text-sm font-semibold truncate">{card.name}</span>
          {kind !== "general" && <CardKindBadge kind={kind} />}
        </span>
        <span className="hidden lg:block text-sm text-neutral-600">{card.sessions} 堂</span>
        <span className="hidden lg:block text-sm font-semibold">${card.price.toLocaleString()}</span>
        <span className="hidden lg:flex flex-col text-sm text-neutral-600">
          單堂 ${perSession.toLocaleString()}
          {savings > 0 && (
            <span className="text-xs text-primary-900">每堂省 ${savings.toLocaleString()}</span>
          )}
        </span>
        <span className="row-span-2 lg:row-span-1 text-[13px] lg:text-sm text-neutral-600 text-right lg:text-left">
          {card.activeHolders > 0 ? `${card.activeHolders} 人持卡` : "—"}
        </span>
        <ChevronRight className="row-span-2 lg:row-span-1 w-4 h-4 text-neutral-400" aria-hidden />
        <span className="lg:hidden col-start-1 text-[13px] text-neutral-600">
          ${card.price.toLocaleString()}・{card.sessions} 堂・單堂 ${perSession.toLocaleString()}
        </span>
      </Link>
    </li>
  );
};

export default CardList;
