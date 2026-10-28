import { describe, expect, it } from "vitest";
import type { Holder, Overview, Remittance } from "@/store/slices/finance";
import { buildTownView, crateStack } from "./townView";

const holder = (id: number, inHand: number, pending = 0): Holder => ({
  user: { id, name: `u${id}` },
  isMember: true,
  opening: 0,
  collected: inHand + pending,
  pending,
  confirmed: 0,
  inHand,
  cardCount: 0,
  heldSince: null,
  daysHeld: 0,
  overdue: false,
  lastSentOn: null,
});

const remit = (id: number, fromId: number, amount: number): Remittance => ({
  id,
  from: { id: fromId, name: `u${fromId}` },
  amount,
  method: "CASH",
  reference: null,
  sentOn: "2026-10-28T00:00:00.000Z",
  note: null,
  status: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  rejectReason: null,
  createdAt: "2026-10-28T04:00:00.000Z",
});

function overview(holders: Holder[], pending: Remittance[] = [], vault = 38000): Overview {
  return {
    setting: { revenueOwner: { id: 9, name: "Sean" }, startDate: "2026-10-01T00:00:00.000Z", openingBalance: 0, openingOwnerLoan: null, overdueDays: 7 },
    totals: { company: 0, vault, inTransit: 0, inHands: 0, prepaid: 0, prepaidSessions: 0, other: 0, ownerLoan: null, netWorth: 0, ownerCollected: 0, ownerCardCount: 0 },
    holders,
    pending,
    unknownCards: [],
    members: [],
  };
}

describe("crateStack", () => {
  it("1 箱 $1,000，四捨五入", () => expect(crateStack(46_700, 66)).toEqual({ count: 47, unit: 1000 }));
  it("堆不下就讓一箱代表更多錢", () => expect(crateStack(200_000, 66)).toEqual({ count: 50, unit: 4000 }));
  it("沒錢或負的 → 空倉庫", () => expect(crateStack(-500, 66).count).toBe(0));
});

describe("buildTownView", () => {
  it("手上或路上有錢的人依多寡排進位置，0 元的不上地圖", () => {
    const view = buildTownView(overview([holder(1, 200), holder(2, 0), holder(3, 5000), holder(4, 0, 3000)]), 1, { slotCount: 2, crateCapacity: 66 });
    expect(view.people.map((p) => [p.id, p.slot])).toEqual([
      [3, 0],
      [4, 1],
      [1, null],
      [2, null],
    ]);
  });

  it("推車走送的人那條路；送的人不在地圖上就借最後一條，依序排隊", () => {
    const view = buildTownView(overview([holder(1, 100, 900), holder(2, 5000)], [remit(11, 1, 900), remit(12, 7, 300)]), 2, { slotCount: 2, crateCapacity: 66 });
    expect(view.carts.map((c) => [c.id, c.route, c.queue])).toEqual([
      [11, 1, 0],
      [12, 1, 1],
    ]);
  });

  it("營收負責人就是 viewer 時 isOwner，背包金額只算代收人", () => {
    const view = buildTownView(overview([holder(1, 100)]), 9, { slotCount: 2, crateCapacity: 66, regions: [{ title: "台南", sub: "" }, { title: "高雄", sub: "" }, { title: "台北", sub: "" }] });
    expect(view.viewer).toEqual({ id: 9, isOwner: true, inHand: 0 });
    expect(view.regions.map((r) => r.title)).toEqual(["台南", "高雄"]);
    expect(view.crates.count).toBe(38);
  });
});
