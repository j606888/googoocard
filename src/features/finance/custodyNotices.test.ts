import { describe, it, expect } from "vitest";
import { fundDeficits, unsettledNotice, warningsNotice } from "./custodyNotices";
import { emptyBuckets } from "@/domains/finance/ledger";

describe("custodyNotices", () => {
  it("spec §14.6 丁丁：台南虧 350，現金 5050 < 預收 5400", () => {
    const b = { ...emptyBuckets(), cash: 5050, prepaid: 5400, funds: { 1: -350 } };
    expect(fundDeficits(b, { 1: "台南" })).toEqual(["台南目前虧 $350：手上的錢比預收少"]);
  });
  it("現金不少於預收、或公積金為正 → 不提醒", () => {
    expect(fundDeficits({ ...emptyBuckets(), cash: 6000, prepaid: 5400, funds: { 1: -350 } }, { 1: "台南" })).toEqual([]);
    expect(fundDeficits({ ...emptyBuckets(), cash: 100, prepaid: 5400, funds: { 1: 50 } }, { 1: "台南" })).toEqual([]);
  });
  it("還沒結算只在早於本月時出現", () => {
    expect(unsettledNotice("2026-10", "2026-11")).toBe("10 月還沒結算");
    expect(unsettledNotice("2026-11", "2026-11")).toBeNull();
    expect(unsettledNotice(undefined, "2026-11")).toBeNull();
  });
  it("warnings", () => {
    expect(warningsNotice([])).toBeNull();
    expect(warningsNotice([{ code: "UNRESOLVED_KEEPER", periodId: 1 }])).toContain("找不到該給誰");
  });
});
