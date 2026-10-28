/**
 * 水庫第一步的純計算（docs/finance-plan.md §2、§5）：大水庫手記帳的分類、代收人手上的錢、
 * 幾天沒繳。server 和畫面共用，不碰資料庫。
 */

/** 大水庫手記帳的分類。sign = +1 進大水庫、-1 從大水庫出去。 */
export const ENTRY_CATEGORIES = {
  VENUE: { label: "場地費", sign: -1 },
  RENT: { label: "場租", sign: -1 },
  TEACHER_PAY: { label: "教師費／發薪", sign: -1 },
  ASSISTANT: { label: "助教費", sign: -1 },
  ADVERTISING: { label: "廣告費", sign: -1 },
  DRINKS: { label: "飲料費", sign: -1 },
  PARTY: { label: "Party／公共", sign: -1 },
  OTHER_EXPENSE: { label: "其他支出", sign: -1 },
  OWNER_LOAN: { label: "老闆放錢進來", sign: 1 },
  OTHER_INCOME: { label: "其他收入", sign: 1 },
} as const satisfies Record<string, { label: string; sign: 1 | -1 }>;

export type EntryCategory = keyof typeof ENTRY_CATEGORIES;
export const ENTRY_CATEGORY_KEYS = Object.keys(ENTRY_CATEGORIES) as EntryCategory[];

export function isEntryCategory(value: string): value is EntryCategory {
  return value in ENTRY_CATEGORIES;
}

/** 這筆對大水庫的影響（帶正負號）。不認得的分類當支出，寧可少算。 */
export function signedEntryAmount(category: string, amount: number): number {
  const sign = isEntryCategory(category) ? ENTRY_CATEGORIES[category].sign : -1;
  return sign * amount;
}

/** 一筆讓代收人手上變多的事：期初代收或一筆課卡收款。 */
export type Collection = { at: Date; amount: number };

/**
 * 最早一筆還沒被繳回蓋掉的收款日期（先收先繳）。全部繳完回 null。
 * 「繳回」包含轉交中的（送出就離開手上了），不含退回、撤回的。
 */
export function oldestUnremitted(collections: Collection[], remitted: number): Date | null {
  let left = remitted;
  const sorted = [...collections].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const c of sorted) {
    if (left >= c.amount) {
      left -= c.amount;
      continue;
    }
    return c.at;
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 從 since 到 now 過了幾個整天。 */
export function daysSince(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
}

/** 公司淨值＝公司的錢 − 預收 − 欠老闆的（第二步才扣待發）。 */
export function netWorth(company: number, prepaid: number, ownerLoan: number): number {
  return company - prepaid - ownerLoan;
}
