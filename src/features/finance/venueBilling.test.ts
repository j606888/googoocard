import { describe, expect, it } from "vitest";
import { beforePackValue, currentPack, sessionsLeft, venueUnit, type BillingPack } from "./venueBilling";

const pack = (over: Partial<BillingPack>): BillingPack => ({
  id: 1,
  venueId: 1,
  sessions: 10,
  price: 4000,
  purchasedAt: "2026-11-01T00:00:00.000Z",
  voidedAt: null,
  used: 0,
  ...over,
});

describe("venueBilling", () => {
  it("每次付的場地：用 perSessionPrice，不看包", () => {
    expect(venueUnit({ id: 1, perSessionPrice: 300 }, [pack({})])).toBe(300);
  });

  it("次數包：先買先用，目前這包是第一包還沒用完的；作廢的不算", () => {
    const packs = [
      pack({ id: 1, used: 10 }),
      pack({ id: 2, sessions: 6, price: 3000, purchasedAt: "2026-11-05T00:00:00.000Z", used: 2 }),
      pack({ id: 3, sessions: 1, price: 1, purchasedAt: "2026-11-02T00:00:00.000Z", voidedAt: "2026-11-03T00:00:00.000Z" }),
    ];
    expect(currentPack(1, packs)?.id).toBe(2);
    expect(venueUnit({ id: 1, perSessionPrice: null }, packs)).toBe(500);
    expect(sessionsLeft(1, packs)).toBe(4);
  });

  it("全部用完 → 最後一包（超用）；沒有包 → null", () => {
    expect(currentPack(1, [pack({ id: 1, used: 12 })])?.id).toBe(1);
    expect(sessionsLeft(1, [pack({ used: 12 })])).toBe(0);
    expect(venueUnit({ id: 1, perSessionPrice: null }, [])).toBeNull();
  });

  it("開帳時手上這包：每次＝總價÷總次數，剩下的價值四捨五入到元", () => {
    expect(beforePackValue(6, 3000, 4)).toEqual({ unit: 500, value: 2000 });
    expect(beforePackValue(3, 1000, 1).value).toBe(333);
  });
});
