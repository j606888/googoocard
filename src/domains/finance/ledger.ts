import type { IncomeSource } from "./income";
import type { Allocation, Payee } from "./types";
import type { ExpiryEvent } from "@/service/finance/expiry";

// 保管中（spec §7.1）：每個保管人手上教室的錢，拆成加起來永遠等於現金的格子。
// 純函式：每件事只讓錢在格子間移動，或同時改變現金與某一格。

export type Keepers = {
  teacherPayer: Record<number, number>; // teacherId → 付款人 userId（自己付自己＝老師本人的 userId）
  teacherUser: Record<number, number | null>; // teacherId → 老師本人的 userId（判斷「自己的」）
  fundKeeper: Record<number, number>; // locationId → keeper userId
  venueLandlord: Record<number, number | null>;
  packPayer: Record<number, number>; // packId → userId
  branchKeeperOfPeriod: (periodId: number) => number | null; // 外部場地每次付由這堂分部負責人付
};

export type LedgerInput = {
  periods: { periodId: number; month: string; income: IncomeSource[]; allocations: Allocation[] | null }[];
  prepaid: { holderUserId: number; value: number }[]; // 已付款、未關閉卡的剩餘價值
  /** 過期收入；value 可以是負的（鎖住後被沖銷的上一版）。 */
  expiries: (Omit<ExpiryEvent, "date" | "soldLocationId"> & Partial<Pick<ExpiryEvent, "date" | "soldLocationId">> & { month: string })[];
  expenses: { amount: number; locationId: number; paidByUserId: number; month: string }[];
  packs: { packId: number; price: number; paidByUserId: number }[];
  transfers: {
    amount: number;
    fromUserId: number;
    toKind: "USER" | "TEACHER" | "SELF" | "VENUE";
    toUserId?: number;
    toTeacherId?: number;
    toVenueId?: number;
    month: string;
  }[];
  /**
   * 退費：卡的剩餘價值 = 退款 + 過期收入（expiries 已含差額）。退款那部分原本在卡的保管人
   * （holderUserId）手上，由 paidByUserId 付出；兩人不同時產生「欠對方」，相同時不影響格子。
   */
  refunds: { amount: number; paidByUserId: number; holderUserId?: number | null; month: string }[];
  fundOpening: Record<number, number>;
  roundings: { userId: number; locationId: number; bucket: "self" | "teacher"; teacherId?: number; amount: number; month: string }[]; // Task 13 寫入
};

export type Buckets = {
  cash: number; // 應有現金 = 各格加總
  prepaid: number;
  unallocated: number;
  self: number;
  teachers: Record<number, number>; // 待付某老師
  funds: Record<number, number>; // 這人保管的公積金
  packs: Record<number, number>; // 場地包（負數＝已付未用）
  venues: Record<number, number>; // 待付外部場地
  peers: Record<number, number>; // 正＝我欠對方；負＝對方欠我
};

type Slot =
  | { kind: "self" }
  | { kind: "teachers" | "funds" | "packs" | "venues"; id: number };

export type ResolvedPayee = { keeper: number; slot: Slot };

const TOLERANCE = 0.005;

export function emptyBuckets(): Buckets {
  return { cash: 0, prepaid: 0, unallocated: 0, self: 0, teachers: {}, funds: {}, packs: {}, venues: {}, peers: {} };
}

/** 一筆分帳該由誰付、進他的哪一格；找不到負責人 → null（呼叫端放進未分配）。 */
export function resolvePayee(payee: Payee, periodId: number, keepers: Keepers): ResolvedPayee | null {
  if (payee.type === "teacher") {
    const keeper = keepers.teacherPayer[payee.teacherId];
    if (keeper === undefined) return null;
    return keepers.teacherUser[payee.teacherId] === keeper
      ? { keeper, slot: { kind: "self" } }
      : { keeper, slot: { kind: "teachers", id: payee.teacherId } };
  }
  if (payee.type === "fund") {
    const keeper = keepers.fundKeeper[payee.locationId];
    return keeper === undefined ? null : { keeper, slot: { kind: "funds", id: payee.locationId } };
  }
  if (payee.packId !== undefined) {
    const keeper = keepers.packPayer[payee.packId];
    return keeper === undefined ? null : { keeper, slot: { kind: "packs", id: payee.packId } };
  }
  const landlord = keepers.venueLandlord[payee.venueId];
  if (landlord !== null && landlord !== undefined) return { keeper: landlord, slot: { kind: "self" } };
  const keeper = keepers.branchKeeperOfPeriod(periodId);
  return keeper === null ? null : { keeper, slot: { kind: "venues", id: payee.venueId } };
}

export function computeCustody(
  input: LedgerInput,
  keepers: Keepers,
  opts?: { through?: string },
): Record<number, Buckets> {
  const out: Record<number, Buckets> = {};
  const get = (userId: number) => (out[userId] ??= emptyBuckets());
  const inRange = (month: string) => !opts?.through || month <= opts.through;

  const addRec = (rec: Record<number, number>, id: number, amount: number) => {
    rec[id] = (rec[id] ?? 0) + amount;
  };
  const addSlot = (userId: number, slot: Slot, amount: number) => {
    const b = get(userId);
    if (slot.kind === "self") b.self += amount;
    else addRec(b[slot.kind], slot.id, amount);
  };
  /** 錢在 holder 手上、該進 keeper 的 slot：不同人 → holder 欠 keeper。 */
  const place = (holder: number, keeper: number, slot: Slot, amount: number) => {
    addSlot(keeper, slot, amount);
    if (keeper !== holder) {
      addRec(get(holder).peers, keeper, amount);
      addRec(get(keeper).peers, holder, -amount);
    }
  };
  const placePayee = (holder: number, payee: Payee, periodId: number, amount: number) => {
    const r = resolvePayee(payee, periodId, keepers);
    if (r) place(holder, r.keeper, r.slot, amount);
    else get(holder).unallocated += amount;
  };

  // 預收：學生付了、還沒上的卡。
  for (const p of input.prepaid) {
    const b = get(p.holderUserId);
    b.cash += p.value;
    b.prepaid += p.value;
  }

  // 公積金期初：在 keeper 手上。
  for (const [locationId, amount] of Object.entries(input.fundOpening)) {
    const keeper = keepers.fundKeeper[Number(locationId)];
    if (keeper === undefined || amount === 0) continue;
    const b = get(keeper);
    b.cash += amount;
    addRec(b.funds, Number(locationId), amount);
  }

  // 每堂：每筆分帳依各 holder 在這堂已實現收入的比例拆。
  for (const period of input.periods) {
    if (!inRange(period.month)) continue;
    // 比例用整堂已實現收入當分母：找不到 holder 的那份連同它的現金一起不進任何人的表。
    const byHolder = new Map<number, number>();
    let total = 0;
    for (const s of period.income) {
      if (!s.paid || s.amount === 0) continue;
      total += s.amount;
      if (s.holderUserId === null) continue;
      byHolder.set(s.holderUserId, (byHolder.get(s.holderUserId) ?? 0) + s.amount);
    }
    for (const [holder, amount] of byHolder) get(holder).cash += amount;

    if (period.allocations === null) {
      for (const [holder, amount] of byHolder) get(holder).unallocated += amount;
      continue;
    }
    let shares: [number, number][];
    if (total !== 0) {
      shares = [...byHolder].map(([holder, amount]) => [holder, amount / total]);
    } else {
      // 沒有收入（例：全是贈送卡）：分帳加總為 0，但固定金額仍要付（基金吸收），
      // 由這堂分部的負責人當作 holder。
      const keeper = keepers.branchKeeperOfPeriod(period.periodId);
      shares = keeper === null ? [] : [[keeper, 1]];
    }
    for (const a of period.allocations) {
      if (a.amount === 0) continue;
      for (const [holder, share] of shares) placePayee(holder, a.payee, period.periodId, a.amount * share);
    }
  }

  // 過期：價值從 holder 的預收（已不在 prepaid）進過期收入對象。
  for (const e of input.expiries) {
    if (!inRange(e.month) || e.holderUserId === null) continue;
    get(e.holderUserId).cash += e.value;
    const r: ResolvedPayee | null =
      e.to.type === "user"
        ? { keeper: e.to.userId, slot: { kind: "self" } }
        : keepers.fundKeeper[e.to.locationId] === undefined
          ? null
          : { keeper: keepers.fundKeeper[e.to.locationId], slot: { kind: "funds", id: e.to.locationId } };
    if (r) place(e.holderUserId, r.keeper, r.slot, e.value);
    else get(e.holderUserId).unallocated += e.value;
  }

  // 退費：退款那部分原本在卡的保管人手上（預收已不含），由 paidByUserId 付出。
  for (const r of input.refunds) {
    if (!inRange(r.month)) continue;
    const holder = r.holderUserId ?? r.paidByUserId;
    if (holder === r.paidByUserId) continue;
    get(holder).cash += r.amount;
    get(r.paidByUserId).cash -= r.amount;
    addRec(get(holder).peers, r.paidByUserId, r.amount);
    addRec(get(r.paidByUserId).peers, holder, -r.amount);
  }

  // 支出：付款人現金 −，公積金 −（keeper 不是付款人 → keeper 欠付款人）。
  for (const e of input.expenses) {
    if (!inRange(e.month)) continue;
    get(e.paidByUserId).cash -= e.amount;
    const keeper = keepers.fundKeeper[e.locationId];
    if (keeper === undefined) get(e.paidByUserId).unallocated -= e.amount;
    else place(e.paidByUserId, keeper, { kind: "funds", id: e.locationId }, -e.amount);
  }

  // 次數包：預付，永遠全量。
  for (const p of input.packs) {
    const b = get(p.paidByUserId);
    b.cash -= p.price;
    addRec(b.packs, p.packId, -p.price);
  }

  // 轉帳：from 現金 −，對應的格子減少。
  for (const t of input.transfers) {
    if (!inRange(t.month)) continue;
    const from = get(t.fromUserId);
    from.cash -= t.amount;
    if (t.toKind === "USER" && t.toUserId !== undefined && t.toUserId !== t.fromUserId) {
      const to = get(t.toUserId);
      to.cash += t.amount;
      addRec(from.peers, t.toUserId, -t.amount);
      addRec(to.peers, t.fromUserId, t.amount);
    } else if (t.toKind === "TEACHER" && t.toTeacherId !== undefined) {
      if (keepers.teacherUser[t.toTeacherId] === t.fromUserId) from.self -= t.amount;
      else addRec(from.teachers, t.toTeacherId, -t.amount);
    } else if (t.toKind === "VENUE" && t.toVenueId !== undefined) {
      addRec(from.venues, t.toVenueId, -t.amount);
    } else {
      from.self -= t.amount;
    }
  }

  // 取整零頭（月結）：從那人的格子移進分部公積金。
  for (const r of input.roundings) {
    if (!inRange(r.month)) continue;
    const slot: Slot =
      r.bucket === "teacher" && r.teacherId !== undefined ? { kind: "teachers", id: r.teacherId } : { kind: "self" };
    addSlot(r.userId, slot, -r.amount);
    const keeper = keepers.fundKeeper[r.locationId];
    if (keeper === undefined) get(r.userId).unallocated += r.amount;
    else place(r.userId, keeper, { kind: "funds", id: r.locationId }, r.amount);
  }

  if (process.env.NODE_ENV !== "production") assertCustodyInvariants(out);
  return out;
}

export function bucketsTotal(b: Buckets): number {
  const sum = (r: Record<number, number>) => Object.values(r).reduce((a, v) => a + v, 0);
  return b.prepaid + b.unallocated + b.self + sum(b.teachers) + sum(b.funds) + sum(b.packs) + sum(b.venues) + sum(b.peers);
}

/** 每人各格加總 = cash；任兩人 peers 反對稱。違反就 throw。 */
export function assertCustodyInvariants(custody: Record<number, Buckets>): void {
  for (const [userId, b] of Object.entries(custody)) {
    const total = bucketsTotal(b);
    if (Math.abs(total - b.cash) > TOLERANCE) {
      throw new Error(`custody invariant: user ${userId} buckets ${total} != cash ${b.cash}`);
    }
    for (const [peer, amount] of Object.entries(b.peers)) {
      const back = custody[Number(peer)]?.peers[Number(userId)] ?? 0;
      if (Math.abs(amount + back) > TOLERANCE) {
        throw new Error(`custody invariant: peers ${userId}→${peer} ${amount} vs ${back}`);
      }
    }
  }
}
