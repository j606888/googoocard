import { describe, expect, it } from "vitest";
import type { LessonSummary } from "@/store/slices/lessons";
import { seriesNameKey, suggestSeries } from "./seriesSuggest";

let nextId = 1;
const lesson = (name: string, over: Partial<LessonSummary> = {}): LessonSummary =>
  ({ id: nextId++, name, groupId: null, firstPeriodStart: null, ...over }) as LessonSummary;

describe("seriesNameKey", () => {
  it("drops brackets, term numbers and months", () => {
    expect(seriesNameKey("Bachata training [KH]")).toBe("bachata training");
    expect(seriesNameKey("Bachata training 第 3 期")).toBe("bachata training");
    expect(seriesNameKey("10月份體驗課")).toBe("體驗課");
    expect(seriesNameKey("Bachata Lv2（台南）")).toBe("bachata lv2");
  });
});

describe("suggestSeries", () => {
  it("clusters same-named lessons and names the 課種 after the newest term", () => {
    const old = lesson("Bachata training [KH]", { firstPeriodStart: "2026-07-23T00:00:00Z" });
    const current = lesson("Bachata training", { firstPeriodStart: "2026-10-15T00:00:00Z" });
    const other = lesson("Salsa");
    const [first, second] = suggestSeries([old, current, other], []);
    expect(first.name).toBe("Bachata training");
    expect(first.lessons.map((l) => l.id)).toEqual([current.id, old.id]);
    expect(second.name).toBe("Salsa");
  });

  it("skips a cluster that already sits in a matching 課種", () => {
    const done = lesson("Salsa", { groupId: 5 });
    const stray = lesson("Bachata", { groupId: 9 });
    const suggestions = suggestSeries([done, stray], [
      { id: 5, name: "Salsa" },
      { id: 9, name: "週日課程" },
    ]);
    expect(suggestions.map((s) => s.name)).toEqual(["Bachata"]);
  });
});
