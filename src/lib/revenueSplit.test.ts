import { describe, expect, it } from "vitest";
import { computeSplit, parseRatio, parseRevenueSplit, defaultRemainderLabel } from "./revenueSplit";

const tainan = {
  steps: [
    { label: "Charlene", teacherId: 19, basis: "total" as const, num: 1, den: 3, amount: null },
    { label: "丁丁", teacherId: 18, basis: "total" as const, num: 1, den: 3, amount: null },
    { label: "場地費", teacherId: null, basis: "fixed" as const, num: null, den: null, amount: 500 },
  ],
  remainderLabel: "台南水庫",
};

describe("computeSplit", () => {
  it("老師各拿總收入 1/3、再扣場地、剩下歸水庫；零頭留給剩下的", () => {
    const r = computeSplit(2240, tainan);
    expect(r.lines.map((l) => l.amount)).toEqual([746, 746, 500]);
    expect(r.remainder).toEqual({ label: "台南水庫", amount: 248 });
  });

  it("先扣場地、再各拿剩下的一半", () => {
    const r = computeSplit(2000, {
      steps: [
        { label: "場地費", teacherId: null, basis: "fixed", num: null, den: null, amount: 400 },
        { label: "A", teacherId: 1, basis: "remaining", num: 1, den: 2, amount: null },
        { label: "B", teacherId: 2, basis: "remaining", num: 1, den: 2, amount: null },
      ],
      remainderLabel: "水庫",
    });
    // A = 1600/2 = 800；B = 剩下 800 的一半 = 400
    expect(r.lines.map((l) => l.amount)).toEqual([400, 800, 400]);
    expect(r.remainder.amount).toBe(400);
  });

  it("收入不夠扣時剩下的是負數", () => {
    expect(computeSplit(300, tainan).remainder.amount).toBe(300 - 100 - 100 - 500);
  });
});

describe("parseRatio", () => {
  it("看得懂分數與百分比", () => {
    expect(parseRatio("1/3")).toEqual({ num: 1, den: 3 });
    expect(parseRatio("25%")).toEqual({ num: 25, den: 100 });
    expect(parseRatio("12.5%")).toEqual({ num: 125, den: 1000 });
    expect(parseRatio("4/3")).toBeNull();
    expect(parseRatio("abc")).toBeNull();
  });
});

describe("parseRevenueSplit", () => {
  it("壞資料回 null", () => {
    expect(parseRevenueSplit(null)).toBeNull();
    expect(parseRevenueSplit({ steps: [{ label: "x", basis: "total" }], remainderLabel: "水庫" })).toBeNull();
    expect(parseRevenueSplit(tainan)?.steps).toHaveLength(3);
  });
  it("預設水庫名", () => {
    expect(defaultRemainderLabel("台南")).toBe("台南水庫");
    expect(defaultRemainderLabel(null)).toBe("水庫");
  });
});
