// 場地的收費方式（純函式，前端用）：每次付（perSessionPrice），或買次數包（先買先用）。
// 伺服器端的同一套規則在 src/service/finance/periods.ts resolvePackUnitPrices。

export type BillingVenue = { id: number; perSessionPrice: number | null };
export type BillingPack = {
  id: number;
  venueId: number;
  sessions: number;
  price: number;
  purchasedAt: string;
  voidedAt: string | null;
  /** 已經用掉幾次（GET /finance/packs）。 */
  used: number;
};

export const packUnit = (p: { sessions: number; price: number }) => (p.sessions > 0 ? p.price / p.sessions : 0);

/** 這個場地有效的包，照先買先用的順序。 */
export function activePacks<P extends BillingPack>(venueId: number, packs: P[]): P[] {
  return packs
    .filter((p) => p.venueId === venueId && !p.voidedAt)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id - b.id);
}

/** 目前在扣的那一包：第一包還沒用完的；全部用完 → 最後一包（超用，照它的單價扣）；沒有包 → null。 */
export function currentPack<P extends BillingPack>(venueId: number, packs: P[]): P | null {
  const list = activePacks(venueId, packs);
  return list.find((p) => p.used < p.sessions) ?? list[list.length - 1] ?? null;
}

/** 「場地費」行這一堂扣多少：每次付 → 那個價；次數包 → 目前這包的單價；都沒有 → null（還不知道）。 */
export function venueUnit(venue: BillingVenue | undefined, packs: BillingPack[]): number | null {
  if (!venue) return null;
  if (venue.perSessionPrice !== null) return venue.perSessionPrice;
  const pack = currentPack(venue.id, packs);
  return pack ? packUnit(pack) : null;
}

/** 這個場地所有有效的包還剩幾次（超用不會變負的）。 */
export function sessionsLeft(venueId: number, packs: BillingPack[]): number {
  return activePacks(venueId, packs).reduce((s, p) => s + Math.max(0, p.sessions - p.used), 0);
}

/** 開帳時「手上這包」：總共幾次、總價、還剩幾次 → 每次多少、剩下的價值（跟 POST /finance/packs before 一樣四捨五入到元）。 */
export function beforePackValue(totalSessions: number, totalPrice: number, remaining: number) {
  return { unit: totalPrice / totalSessions, value: Math.round((totalPrice * remaining) / totalSessions) };
}
