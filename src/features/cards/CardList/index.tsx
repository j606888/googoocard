"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { formatMoney } from "@/lib/money";
import SegmentedTabs from "@/components/SegmentedTabs";
import Select from "@/components/Select";
import InfoTip from "@/components/InfoTip";
import DanceStyleDot from "@/components/DanceStyleDot";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import CardListSkeleton from "./CardListSkeleton";
import CardSheet, { CardSheetView } from "../CardSheet";
import CardFormDrawer from "../CardForm/CardFormDrawer";
import type { CardFormTarget } from "../CardForm/useCardForm";
import { CardKindBadge } from "../CardKindBadge";
import {
  cardKind,
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
 * 課卡頁：一張依舞種分組的價目表（去框線：分組標題＋細線分隔的列，沒有外框）。
 * 點方案才看得到詳情——桌面從右邊滑出抽屜（背景調暗、列表還看得到），手機進整頁（`/cards/[id]`）。
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

  const styleOptions: { value: StyleFilter; label: string }[] = [
    { value: "all", label: "全部舞種" },
    ...allGroups.map((group) =>
      group.danceStyleId === null
        ? { value: "none" as const, label: "不限舞種" }
        : { value: group.danceStyleId, label: byId.get(group.danceStyleId)?.name ?? "舞種" }
    ),
  ];

  return (
    <div className="flex w-full flex-col px-5 pt-5 pb-10 lg:max-w-[1180px] lg:px-12 lg:pt-9">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold text-ink lg:text-[26px]">課卡</h1>
        <Button onClick={() => newPlan()}>
          <Plus className="size-4" />
          新增方案
        </Button>
      </div>

      {!hasAnyCard ? (
        <EmptyState kind="page" pose="card" title="還沒有課卡方案" description="建立第一個方案，學生就可以買了。" />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <SegmentedTabs
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
            {styleOptions.length > 2 && (
              <Select
                size="plain"
                aria-label="舞種"
                className="w-auto"
                value={styleFilter}
                onChange={setStyleFilter}
                options={styleOptions}
              />
            )}
            {tab === "archived" && (
              <InfoTip label="已下架說明">
                已下架的方案學生買不到，但已發出的卡照常扣堂。點開方案可以重新開放。
              </InfoTip>
            )}
          </div>

          {groups.length === 0 && (
            <div className="mt-6">
              <EmptyState
                kind="inline"
                title={tab === "archived" ? "沒有已下架的方案。" : "沒有開放購買的方案。"}
              />
            </div>
          )}

          {groups.map((group) => {
            const style = group.danceStyleId !== null ? byId.get(group.danceStyleId) : undefined;
            const headingId = `card-group-${group.danceStyleId ?? "none"}`;
            return (
              <section
                key={group.danceStyleId ?? "none"}
                aria-labelledby={headingId}
                className="mt-8 lg:mt-9"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <DanceStyleDot style={style} />
                    <h2 id={headingId} className="truncate text-[17px] font-semibold text-ink">
                      {style?.name ?? "不限舞種"}
                    </h2>
                    <span className="shrink-0 text-[13px] text-ink-3">
                      {!style ? "任何舞種的課都能用" : style.hasLevels ? "分初階・中階・進階" : "不分級"}
                    </span>
                  </div>
                  {tab === "open" && (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => newPlan(group.danceStyleId)}
                      className="shrink-0 text-[13px]"
                    >
                      ＋加一個方案
                    </Button>
                  )}
                </div>
                <ul className="mt-1 divide-y divide-line border-b border-line">
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
 * 價目表的一列。單一元件樹：手機兩行（名稱／價格摘要），桌面攤成欄位（堂數、價格、
 * 每堂、持卡人數，數字右對齊、等寬）——兩邊不同的只有幾個沒有狀態的文字片段
 * （docs/ui-responsive.md 允許的 `hidden lg:`）。
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
    <li>
      <Link
        href={`/cards/${card.id}`}
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={`-mx-3 grid min-h-14 grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-2 transition-colors lg:min-h-13 lg:grid-cols-[minmax(0,1fr)_72px_104px_136px_104px_16px] lg:gap-x-5 ${
          selected ? "bg-primary-50" : "hover:bg-primary-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-medium text-ink">{card.name}</span>
          {kind !== "general" && <CardKindBadge kind={kind} />}
        </span>
        <span className="hidden text-right text-[15px] tabular-nums text-ink-2 lg:block">{card.sessions} 堂</span>
        <span className="hidden text-right text-[15px] font-semibold tabular-nums text-ink lg:block">
          ${formatMoney(card.price)}
        </span>
        <span className="hidden flex-col text-right text-[13px] tabular-nums text-ink-2 lg:flex">
          每堂 ${formatMoney(perSession)}
          {savings > 0 && (
            <span className="font-semibold text-primary-800">每堂省 ${formatMoney(savings)}</span>
          )}
        </span>
        <span className="row-span-2 text-right text-[13px] tabular-nums text-ink-3 lg:row-span-1 lg:text-[15px] lg:text-ink-2">
          {card.activeHolders > 0 ? `${card.activeHolders} 人持卡` : "—"}
        </span>
        <ChevronRight className="row-span-2 size-4 text-ink-3 lg:row-span-1" aria-hidden />
        <span className="col-start-1 truncate text-[13px] tabular-nums text-ink-3 lg:hidden">
          ${formatMoney(card.price)} · {card.sessions} 堂 · 每堂 ${formatMoney(perSession)}
        </span>
      </Link>
    </li>
  );
};

export default CardList;
