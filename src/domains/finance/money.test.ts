import { describe, it, expect } from "vitest";
import { daysSince, oldestUnremitted, signedEntryAmount } from "./money";

const d = (s: string) => new Date(`${s}T12:00:00+08:00`);

describe("oldestUnremitted（先收先繳）", () => {
  const collections = [
    { at: d("2026-11-03"), amount: 2000 },
    { at: d("2026-11-01"), amount: 1000 },
  ];
  it("什麼都沒繳 → 最早那筆", () => expect(oldestUnremitted(collections, 0)).toEqual(d("2026-11-01")));
  it("繳掉最早那筆 → 下一筆", () => expect(oldestUnremitted(collections, 1000)).toEqual(d("2026-11-03")));
  it("只繳一部分 → 那筆還沒蓋掉", () => expect(oldestUnremitted(collections, 999)).toEqual(d("2026-11-01")));
  it("全部繳完 → null", () => expect(oldestUnremitted(collections, 3000)).toBeNull());
});

describe("signedEntryAmount", () => {
  it("支出是負的、老闆放錢是正的", () => {
    expect(signedEntryAmount("VENUE", 500)).toBe(-500);
    expect(signedEntryAmount("OWNER_LOAN", 500)).toBe(500);
  });
  it("不認得的分類當支出", () => expect(signedEntryAmount("???", 10)).toBe(-10));
});

it("daysSince 取整天、不會是負的", () => {
  expect(daysSince(d("2026-11-01"), d("2026-11-04"))).toBe(3);
  expect(daysSince(d("2026-11-05"), d("2026-11-04"))).toBe(0);
});
