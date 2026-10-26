import { describe, it, expect } from "vitest";
import { calculateSplit, classShare, type SplitInput } from "./split";

const base: SplitInput = { income: 2000, rent: 250, poolRate: 0.1, memberCount: 2, roundUnit: 10 };

describe("calculateSplit", () => {
  it("扣場租 → 提撥 10% → 兩人平分 → 捨去到 10，零頭歸水庫（SALSA 體驗 2,000、場租 250）", () => {
    const r = calculateSplit(base);
    expect(r.distributable).toBe(1750);
    expect(r.pool).toBe(175);
    expect(r.remaining).toBe(1575);
    expect(r.perMember).toBe(787.5);
    expect(r.perMemberRounded).toBe(780);
    expect(r.leftover).toBe(15);
    expect(r.toTank).toBe(190);
  });

  it("每一塊錢都有去處：場租＋水庫＋每人 × 人數 = 收入", () => {
    for (const input of [
      base,
      { ...base, income: 3996, rent: 400 },
      { ...base, income: 3000, rent: 500, memberCount: 1 },
      { ...base, income: 4321, rent: 123, memberCount: 3, roundUnit: 100 as const },
    ]) {
      const r = calculateSplit(input);
      expect(input.rent + r.toTank + r.perMemberRounded * input.memberCount).toBeCloseTo(input.income, 9);
    }
  });

  it("提撥四捨五入到元（3,596 × 10% = 359.6 → 360）", () => {
    const r = calculateSplit({ ...base, income: 3996, rent: 400 });
    expect(r.pool).toBe(360);
    expect(r.perMember).toBe(1618);
    expect(r.perMemberRounded).toBe(1610);
    expect(r.leftover).toBe(16);
  });

  it.each([
    [1, 787, 1],
    [10, 780, 15],
    [100, 700, 175],
  ] as const)("取整單位 %i：每人 %i、零頭 %i", (roundUnit, perMemberRounded, leftover) => {
    const r = calculateSplit({ ...base, roundUnit });
    expect(r.perMemberRounded).toBe(perMemberRounded);
    expect(r.leftover).toBe(leftover);
  });

  it("剛好整除時沒有零頭", () => {
    const r = calculateSplit({ ...base, income: 3000, rent: 500, memberCount: 1 });
    expect(r.perMemberRounded).toBe(2250);
    expect(r.leftover).toBe(0);
    expect(r.toTank).toBe(250);
  });

  it("除不盡的人數照樣捨去（1,000 ÷ 3）", () => {
    const r = calculateSplit({ income: 1000, rent: 0, poolRate: 0, memberCount: 3, roundUnit: 10 });
    expect(r.perMemberRounded).toBe(330);
    expect(r.leftover).toBe(10);
  });

  it("場租比收入多：沒有可分配的錢，不會分出負數", () => {
    const r = calculateSplit({ ...base, income: 200, rent: 250 });
    expect(r.distributable).toBe(0);
    expect(r.pool).toBe(0);
    expect(r.perMemberRounded).toBe(0);
    expect(r.toTank).toBe(0);
  });

  it("沒有授課成員：提撥後剩下的全部歸水庫", () => {
    const r = calculateSplit({ ...base, memberCount: 0 });
    expect(r.perMember).toBe(0);
    expect(r.perMemberRounded).toBe(0);
    expect(r.leftover).toBe(1575);
    expect(r.toTank).toBe(1750);
  });

  it("負的收入或場租（打錯）當 0 算", () => {
    expect(calculateSplit({ ...base, income: -500 }).distributable).toBe(0);
    expect(calculateSplit({ ...base, rent: -250 }).distributable).toBe(2000);
  });

  it("收入有小數時，浮點誤差不會讓取整少掉一個單位（1024.07 − 0.07）", () => {
    const r = calculateSplit({ income: 1024.07, rent: 0.07, poolRate: 0, memberCount: 1, roundUnit: 1 });
    expect(r.perMemberRounded).toBe(1024);
  });
});

describe("classShare（每堂認列，最後一堂補零頭）", () => {
  it("6 堂 2,000：前 5 堂 333.33、第 6 堂 333.35", () => {
    const shares = [1, 2, 3, 4, 5, 6].map((nth) => classShare({ price: 2000, classes: 6, nth }));
    expect(shares).toEqual([333.33, 333.33, 333.33, 333.33, 333.33, 333.35]);
  });

  it("6 堂 2,000 加總剛好 2,000，零頭不會不見", () => {
    const totalCents = [1, 2, 3, 4, 5, 6].reduce(
      (sum, nth) => sum + Math.round(classShare({ price: 2000, classes: 6, nth }) * 100),
      0
    );
    expect(totalCents).toBe(200000);
  });

  it("單堂 400 → 400", () => {
    expect(classShare({ price: 400, classes: 1, nth: 1 })).toBe(400);
  });

  it("整除的課卡每堂一樣（10 堂 3,000 → 300）", () => {
    expect(classShare({ price: 3000, classes: 10, nth: 1 })).toBe(300);
    expect(classShare({ price: 3000, classes: 10, nth: 10 })).toBe(300);
  });

  it("最後一堂只會多、不會少（6 堂 2,500：416.66 × 5、416.70）", () => {
    expect(classShare({ price: 2500, classes: 6, nth: 1 })).toBe(416.66);
    expect(classShare({ price: 2500, classes: 6, nth: 6 })).toBe(416.7);
  });

  it("堂數或第幾堂不合理就丟錯", () => {
    expect(() => classShare({ price: 2000, classes: 0, nth: 1 })).toThrow(RangeError);
    expect(() => classShare({ price: 2000, classes: 6, nth: 0 })).toThrow(RangeError);
    expect(() => classShare({ price: 2000, classes: 6, nth: 7 })).toThrow(RangeError);
    expect(() => classShare({ price: 2000, classes: 6, nth: 1.5 })).toThrow(RangeError);
  });
});
