/**
 * 把水庫總覽（GET /api/finance/overview）換成小鎮要畫的東西（docs/finance-game-style.md §2）：
 * 誰站在地圖上哪個位置、有幾台推車、主堡裡堆幾箱。純函式，不碰 React。
 */
import type { Holder, Overview, PaymentMethod, Remittance } from "@/store/slices/finance";

/** 圍巾顏色＝這個人（§3.4）。依 userId 固定挑，同一個人每天都同一條。 */
const SCARVES = ["#4BB38B", "#7FA8E0", "#F2A7C3", "#F6C344", "#B49AE0", "#6CC3C9", "#E9A86B"];
export const OWNER_SCARF = "#E58B7A";
export const COURIER_SCARF = "#6FA8DC";
/** 推車沙漏條滿格的天數（§8 暫定 3 天）。 */
export const CONFIRM_LIMIT_DAYS = 3;

export const scarfOf = (userId: number) => SCARVES[userId % SCARVES.length];

export interface TownPerson {
  id: number;
  name: string;
  scarf: string;
  inHand: number;
  pending: number;
  collected: number;
  confirmed: number;
  daysHeld: number;
  overdue: boolean;
  isMember: boolean;
  /** 地圖上站哪個位置；null ＝ 只在背包列。 */
  slot: number | null;
}

export interface TownCart {
  id: number;
  fromId: number;
  fromName: string;
  scarf: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  sentOn: string;
  createdAt: string;
  note: string | null;
  /** 走哪個位置的路（送的人沒有位置時借最後一條）。 */
  route: number;
  /** 門口排第幾台。 */
  queue: number;
}

export interface TownView {
  owner: { id: number; name: string; scarf: string } | null;
  /** 所有代收人（背包列），手上＋路上多的在前面。 */
  people: TownPerson[];
  carts: TownCart[];
  figures: Overview["totals"];
  crates: { count: number; unit: number };
  viewer: { id: number; isOwner: boolean; inHand: number };
  /** 地區看板：教室的分部（名稱＋地址），最多兩個。 */
  regions: { title: string; sub: string }[];
  startDate: string;
  overdueDays: number;
  unknownCount: number;
}

/** 箱子：1 箱 $1,000；錢多到堆不下時，一箱代表更多錢（整千）。負的或 0 就是空倉庫。 */
export function crateStack(vault: number, capacity: number): { count: number; unit: number } {
  if (vault <= 0 || capacity <= 0) return { count: 0, unit: 1000 };
  const unit = Math.max(1000, Math.ceil(vault / capacity / 1000) * 1000);
  return { count: Math.min(capacity, Math.round(vault / unit)), unit };
}

function person(h: Holder): Omit<TownPerson, "slot"> {
  return {
    id: h.user.id,
    name: h.user.name,
    scarf: scarfOf(h.user.id),
    inHand: h.inHand,
    pending: h.pending,
    collected: h.collected,
    confirmed: h.confirmed,
    daysHeld: h.daysHeld,
    overdue: h.overdue,
    isMember: h.isMember,
  };
}

export function buildTownView(
  overview: Overview,
  viewerId: number,
  { slotCount, crateCapacity, regions = [] }: { slotCount: number; crateCapacity: number; regions?: { title: string; sub: string }[] }
): TownView {
  const owner = overview.setting.revenueOwner;
  const people = overview.holders
    .map(person)
    .sort((a, b) => b.inHand + b.pending - (a.inHand + a.pending))
    .map((p) => ({ ...p, slot: null as number | null }));
  // 手上或路上有錢的人才畫在地圖上（§2：手上 $0 的人不畫背包），排不下的留在背包列。
  let next = 0;
  for (const p of people) {
    if (next >= slotCount) break;
    if (p.inHand > 0 || p.pending > 0) p.slot = next++;
  }
  const slotOf = new Map(people.map((p) => [p.id, p.slot]));
  const carts: TownCart[] = overview.pending.map((r: Remittance, queue) => ({
    id: r.id,
    fromId: r.from.id,
    fromName: r.from.name,
    scarf: scarfOf(r.from.id),
    amount: r.amount,
    method: r.method,
    reference: r.reference,
    sentOn: r.sentOn,
    createdAt: r.createdAt,
    note: r.note,
    route: slotOf.get(r.from.id) ?? Math.max(0, slotCount - 1),
    queue,
  }));
  const me = people.find((p) => p.id === viewerId);
  return {
    owner: owner && { id: owner.id, name: owner.name, scarf: OWNER_SCARF },
    people,
    carts,
    figures: overview.totals,
    crates: crateStack(overview.totals.vault, crateCapacity),
    viewer: { id: viewerId, isOwner: owner?.id === viewerId, inHand: me?.inHand ?? 0 },
    regions: regions.slice(0, 2),
    startDate: overview.setting.startDate,
    overdueDays: overview.setting.overdueDays,
    unknownCount: overview.unknownCards.length,
  };
}
