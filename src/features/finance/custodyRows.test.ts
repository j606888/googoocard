import { describe, it, expect } from "vitest";
import { custodyRows } from "./custodyRows";
import type { NameMaps } from "./custodyRows";
import { emptyBuckets } from "@/domains/finance/ledger";

// 丁丁 = userId 1, Sean = 2；老師 Nora = 10, Charlene = 11；分部 台南 = 100, 高雄 = 101
const names: NameMaps = {
  self: "丁丁",
  teachers: { 10: "Nora", 11: "Charlene" },
  locations: { 100: "台南", 101: "高雄" },
  venues: { 5: "24steps" },
  users: { 1: "丁丁", 2: "Sean" },
};

describe("custodyRows", () => {
  it("spec §14.4 丁丁：順序與文字", () => {
    const b = {
      ...emptyBuckets(),
      cash: 9950,
      prepaid: 5400,
      self: 2850,
      teachers: { 10: 683.34, 11: 666.66 },
      funds: { 100: -350 },
      peers: { 2: 700 },
    };
    expect(custodyRows(b, names)).toEqual([
      { label: "預收（學生還沒上的卡）", amount: 5400, tone: "locked" },
      { label: "待付 Nora", amount: 683.34, tone: "owed" },
      { label: "待付 Charlene", amount: 666.66, tone: "owed" },
      { label: "丁丁自己的", amount: 2850, tone: "mine" },
      { label: "台南公積金", amount: -350, tone: "fund" },
      { label: "欠 Sean", amount: 700, tone: "owed" },
    ]);
  });

  it("spec §14.4 Sean：場地包、丁丁欠我、高雄公積金", () => {
    const b = {
      ...emptyBuckets(),
      prepaid: 1666.67,
      self: 641.92,
      teachers: { 11: 275.25 },
      funds: { 101: -148.83 },
      packs: { 7: -3645 },
      peers: { 1: -700 },
    };
    const rows = custodyRows(b, { ...names, self: "Sean" });
    expect(rows.map((r) => r.label)).toEqual([
      "預收（學生還沒上的卡）",
      "待付 Charlene",
      "Sean自己的",
      "高雄公積金",
      "場地包",
      "丁丁欠我",
    ]);
    expect(rows.find((r) => r.label === "丁丁欠我")).toEqual({ label: "丁丁欠我", amount: -700, tone: "peer" });
    expect(rows.find((r) => r.label === "場地包")?.tone).toBe("pack");
  });

  it("金額四捨五入後為 0 的列不顯示，預收除外；有待付場地與未分配", () => {
    const b = { ...emptyBuckets(), prepaid: 0, self: 0.2, venues: { 5: 405 }, unallocated: 100 };
    expect(custodyRows(b, names)).toEqual([
      { label: "預收（學生還沒上的卡）", amount: 0, tone: "locked" },
      { label: "待付 24steps", amount: 405, tone: "owed" },
      { label: "未分配", amount: 100, tone: "owed" },
    ]);
  });
});
