import { Card, CardHolder } from "@/store/slices/cards";
import { SortOption } from "@/components/SortMenu";

/**
 * 課卡列表與卡片詳細頁共用的推導邏輯。全部是純函式——
 * 分組與排序一律在前端做（列表沒有分頁，資料本來就整份在手上），
 * 「單堂價」「快用完」也不是 DB 單一欄位排得出來的。
 */

/** 單堂價。堂數為 0 的卡（理論上不該存在）回 0，避免除以零。 */
export const perSessionPrice = (card: Pick<Card, "price" | "sessions">): number =>
  card.sessions > 0 ? Math.round(card.price / card.sessions) : 0;

// —— 方案種類 ——

/**
 * 「這張卡給誰買」。DB 上是兩個布林（`isPracticeCard` / `isTrial`），
 * 但畫面上是三選一：同時是複習卡又是體驗卡沒有意義。萬一舊資料兩個都開，
 * 以複習卡為準——那個旗標會擋購買資格，比較不能裝作沒看到。
 */
export type CardKind = "general" | "practice" | "trial";

export const cardKind = (card: Pick<Card, "isPracticeCard" | "isTrial">): CardKind =>
  card.isPracticeCard ? "practice" : card.isTrial ? "trial" : "general";

export const kindFlags = (kind: CardKind) => ({
  isPracticeCard: kind === "practice",
  isTrial: kind === "trial",
});

const KIND_ORDER: Record<CardKind, number> = { general: 0, practice: 1, trial: 2 };

// —— 價目表分組 ——

export interface CardGroup {
  /** `null` = 不限舞種（一般卡可以不掛舞種）。 */
  danceStyleId: number | null;
  cards: Card[];
}

/**
 * 依舞種分組，組的順序照教室的舞種排序（`styleOrder`），不限舞種排最後。
 * 組內：一般 → 複習 → 體驗，同種依堂數、再依價格——讀起來就是一張價目表。
 */
export const groupByDanceStyle = (cards: Card[], styleOrder: number[]): CardGroup[] => {
  const groups = new Map<number | null, Card[]>();
  for (const card of cards) {
    const key = card.danceStyleId ?? null;
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  const rank = (id: number | null) => {
    if (id === null) return Number.MAX_SAFE_INTEGER;
    const index = styleOrder.indexOf(id);
    // 不在清單裡的舞種（理論上不會發生）排在已知舞種後面、不限舞種前面。
    return index === -1 ? Number.MAX_SAFE_INTEGER - 1 : index;
  };
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([danceStyleId, group]) => ({
      danceStyleId,
      cards: [...group].sort(
        (a, b) =>
          KIND_ORDER[cardKind(a)] - KIND_ORDER[cardKind(b)] ||
          a.sessions - b.sessions ||
          a.price - b.price
      ),
    }));
};

/**
 * 一般卡比同組最貴的一般方案每堂省多少（沒省就 0）。
 * 「堂數越多單堂越便宜」是定價的直覺，列表上直接寫出來比讓人心算好。
 */
export const perSessionSavings = (card: Card, group: Card[]): number => {
  if (cardKind(card) !== "general") return 0;
  const generals = group.filter((c) => cardKind(c) === "general");
  const highest = Math.max(...generals.map(perSessionPrice));
  return Math.max(0, highest - perSessionPrice(card));
};

/** 新方案的預設名稱：「Hustle 8 堂」「Hustle 複習 4 堂」「Hustle 體驗課」。 */
export const autoCardName = ({
  styleName,
  kind,
  sessions,
}: {
  styleName: string | null;
  kind: CardKind;
  sessions: number;
}): string => {
  const style = styleName ? `${styleName} ` : "";
  if (kind === "trial") return `${style}體驗課`;
  const count = sessions > 0 ? `${sessions} 堂` : "";
  return `${style}${kind === "practice" ? "複習 " : ""}${count}`.trim();
};

export interface CardsSummary {
  /** 課卡「種類」數，不是張數。 */
  kinds: number;
  /**
   * 還有剩餘堂數的 StudentCard 筆數。
   * 注意：這是張數不是人數——同一個學生持有兩種卡會被算兩次。
   */
  activeStudentCards: number;
  totalRevenue: number;
}

export const cardsSummary = (cards: Card[]): CardsSummary => ({
  kinds: cards.length,
  activeStudentCards: cards.reduce((sum, card) => sum + card.activeHolders, 0),
  totalRevenue: cards.reduce((sum, card) => sum + card.totalRevenue, 0),
});

// —— 持卡人 ——

/**
 * 「快用完」的門檻：剩下這麼多堂（含）以內就該提醒老師談續卡。
 * 注意這與 `src/service/studentTag.ts` 的 Needs Renewal（剩餘 === 0）
 * 是兩件事——那是「已經用完」，這是「還來得及在現場開口」。
 */
export const RENEWAL_SOON_SESSIONS = 1;

export const isRunningOut = (holder: Pick<CardHolder, "remainingSessions">): boolean =>
  holder.remainingSessions <= RENEWAL_SOON_SESSIONS;

export type HolderSort = "remaining" | "newest" | "oldest";

export const HOLDER_SORT_OPTIONS: SortOption<HolderSort>[] = [
  { value: "remaining", label: "剩餘堂數（少到多）", short: "剩餘堂數" },
  { value: "newest", label: "購買日（新到舊）", short: "購買日新" },
  { value: "oldest", label: "購買日（舊到新）", short: "購買日舊" },
];

/** 打開這頁多半是要找「誰快用完該催續卡」，所以預設就把他們排到最上面。 */
export const DEFAULT_HOLDER_SORT: HolderSort = "remaining";

export const sortHolders = (holders: CardHolder[], sort: HolderSort): CardHolder[] => {
  const purchasedAt = (holder: CardHolder) => new Date(holder.createdAt).getTime();
  const sorted = [...holders];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => purchasedAt(b) - purchasedAt(a));
    case "oldest":
      return sorted.sort((a, b) => purchasedAt(a) - purchasedAt(b));
    default:
      // 剩得一樣少時，先買的先催——他們已經來得比較久了。
      return sorted.sort(
        (a, b) => a.remainingSessions - b.remainingSessions || purchasedAt(a) - purchasedAt(b)
      );
  }
};
