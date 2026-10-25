import { describe, it, expect } from "vitest";
import { selfServicePrice } from "./trial";

describe("selfServicePrice", () => {
  it("體驗卡：舊生免費、新同學照價", () => {
    expect(selfServicePrice({ price: 400, isTrial: true }, true)).toBe(0);
    expect(selfServicePrice({ price: 400, isTrial: true }, false)).toBe(400);
  });
  it("一般卡不管新舊都照價", () => {
    expect(selfServicePrice({ price: 2000, isTrial: false }, true)).toBe(2000);
    expect(selfServicePrice({ price: 2000, isTrial: false }, false)).toBe(2000);
  });
});
