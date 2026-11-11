import { describe, expect, it } from "vitest";
import type { LessonSummary } from "@/store/slices/lessons";
import {
  draftSeries,
  isSeriesGroup,
  locationHint,
  seriesNameKey,
  suggestedLocationId,
  unorganizedLessonCount,
} from "./seriesSuggest";

let nextId = 1;
const lesson = (name: string, over: Partial<LessonSummary> = {}): LessonSummary =>
  ({ id: nextId++, name, groupId: null, location: null, firstPeriodStart: null, ...over }) as LessonSummary;

const TAINAN = { id: 1, name: "台南" };
const KAOHSIUNG = { id: 2, name: "高雄" };
const LOCATIONS = [TAINAN, KAOHSIUNG];

describe("seriesNameKey", () => {
  it("drops brackets, term numbers, months and schedule numbering", () => {
    expect(seriesNameKey("Bachata training [KH]")).toBe("bachata training");
    expect(seriesNameKey("Bachata training 第 3 期")).toBe("bachata training");
    expect(seriesNameKey("10月份體驗課")).toBe("體驗課");
    expect(seriesNameKey("Bachata Lv2（台南）")).toBe("bachata lv2");
    expect(seriesNameKey("1. Bachata 進階")).toBe("bachata 進階");
    expect(seriesNameKey("3. Bachata Lv2")).toBe(seriesNameKey("Bachata lv2"));
    expect(seriesNameKey("Bachata(KH)")).toBe("bachata");
  });
});

describe("locationHint", () => {
  it("reads location codes and names from brackets", () => {
    expect(locationHint("Kizomba [KH]", LOCATIONS)).toBe(KAOHSIUNG);
    expect(locationHint("Bachata(KH)", LOCATIONS)).toBe(KAOHSIUNG);
    expect(locationHint("Bachata Lv2（台南）", LOCATIONS)).toBe(TAINAN);
    expect(locationHint("Salsa Lv1", LOCATIONS)).toBeNull();
    expect(locationHint("Kizomba [KH]", [TAINAN])).toBeNull();
  });

  it("keeps a set location, then the hint, then the first location", () => {
    expect(suggestedLocationId(lesson("Kizomba [KH]", { location: TAINAN }), LOCATIONS)).toBe(1);
    expect(suggestedLocationId(lesson("Kizomba [KH]"), LOCATIONS)).toBe(2);
    expect(suggestedLocationId(lesson("Salsa"), LOCATIONS)).toBe(1);
    expect(suggestedLocationId(lesson("Salsa"), [])).toBeNull();
  });
});

describe("isSeriesGroup", () => {
  it("tells a 課種 from an old time-slot group", () => {
    expect(isSeriesGroup({ id: 1, name: "Bachata Lv1" }, [lesson("2. Bachata Lv1")])).toBe(true);
    expect(isSeriesGroup({ id: 1, name: "週日課程" }, [lesson("Bachata Lv1")])).toBe(false);
  });
});

describe("draftSeries", () => {
  it("splits old time-slot groups by name and names each 課種 after its newest term", () => {
    const sunday = { id: 9, name: "週日課程" };
    const old = lesson("Bachata Lv1", { groupId: 9, firstPeriodStart: "2025-09-21T00:00:00Z" });
    const recent = lesson("2. Bachata Lv1", { groupId: 9, firstPeriodStart: "2026-06-07T00:00:00Z" });
    const salsa = lesson("4. Salsa Lv1", { groupId: 9 });
    const drafts = draftSeries([old, recent, salsa], [sunday]);
    expect(drafts.map((d) => [d.name, d.lessonIds])).toEqual([
      ["Bachata Lv1", [recent.id, old.id]],
      ["Salsa Lv1", [salsa.id]],
    ]);
    expect(drafts.every((d) => d.enabled)).toBe(true);
  });

  it("names a new 課種 after the most common spelling", () => {
    const drafts = draftSeries(
      [
        lesson("Bachata lv2", { firstPeriodStart: "2026-08-09T00:00:00Z" }),
        lesson("3. Bachata Lv2", { firstPeriodStart: "2026-06-07T00:00:00Z" }),
        lesson("Bachata Lv2", { firstPeriodStart: "2026-01-11T00:00:00Z" }),
      ],
      []
    );
    expect(drafts[0].name).toBe("Bachata Lv2");
  });

  it("keeps existing 課種 and pulls same-named stray lessons into them", () => {
    const group = { id: 5, name: "Bachata 進階" };
    const term1 = lesson("Bachata 進階", { groupId: 5 });
    const stray = lesson("1. Bachata 進階", { groupId: null });
    const [draft] = draftSeries([term1, stray], [group]);
    expect(draft.key).toBe("g5");
    expect(draft.name).toBe("Bachata 進階");
    expect(draft.lessonIds.sort()).toEqual([term1.id, stray.id].sort());
  });
});

describe("unorganizedLessonCount", () => {
  it("counts lessons in old groups and loose lessons that would be grouped", () => {
    const sunday = { id: 9, name: "週日課程" };
    const series = { id: 5, name: "Salsa" };
    const lessons = [
      lesson("Bachata", { groupId: 9 }),
      lesson("Salsa", { groupId: 5 }),
      lesson("Salsa"),
      lesson("Kizomba"),
      lesson("Zouk"),
      lesson("Zouk [KH]"),
    ];
    // Bachata（舊群組）＋ 沒歸的 Salsa ＋ 兩門 Zouk；只有一期的 Kizomba 不算。
    expect(unorganizedLessonCount(lessons, [sunday, series])).toBe(4);
    expect(unorganizedLessonCount([lesson("Salsa", { groupId: 5 })], [series])).toBe(0);
  });
});
