import { Card, CardHolder } from "@/store/slices/cards";
import { SortOption } from "@/components/SortMenu";

/**
 * 課卡列表與卡片詳細頁共用的推導邏輯。全部是純函式——
 * 排序一律在前端做（列表沒有分頁，資料本來就整份在手上），
 * 「單堂價」「快用完」也不是 DB 單一欄位排得出來的。
 */

/** 單堂價。堂數為 0 的卡（理論上不該存在）回 0，避免除以零。 */
export const perSessionPrice = (card: Pick<Card, "price" | "sessions">): number =>
  card.sessions > 0 ? Math.round(card.price / card.sessions) : 0;

// —— 列表排序 ——

export type CardSort = "newest" | "revenue" | "holders" | "perSession";

export const CARD_SORT_OPTIONS: SortOption<CardSort>[] = [
  { value: "newest", label: "最新建立", short: "最新建立" },
  { value: "revenue", label: "累積收入（高到低）", short: "累積收入" },
  { value: "holders", label: "持卡人數（多到少）", short: "持卡人數" },
  { value: "perSession", label: "單堂價（低到高）", short: "單堂價" },
];

/** 維持後端 `orderBy: { createdAt: "desc" }` 的既有預設。 */
export const DEFAULT_CARD_SORT: CardSort = "newest";

const byName = (a: Card, b: Card) => a.name.localeCompare(b.name, "zh-Hant");

export const sortCards = (cards: Card[], sort: CardSort): Card[] => {
  const sorted = [...cards];
  switch (sort) {
    case "revenue":
      return sorted.sort((a, b) => b.totalRevenue - a.totalRevenue || byName(a, b));
    case "holders":
      return sorted.sort((a, b) => b.activeHolders - a.activeHolders || byName(a, b));
    case "perSession":
      return sorted.sort(
        (a, b) => perSessionPrice(a) - perSessionPrice(b) || byName(a, b)
      );
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || byName(a, b)
      );
  }
};

/** 一般卡在上、複習卡在下；組內順序沿用傳進來的排序。 */
export const splitByType = (cards: Card[]): { general: Card[]; practice: Card[] } => ({
  general: cards.filter((card) => !card.isPracticeCard),
  practice: cards.filter((card) => card.isPracticeCard),
});

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
