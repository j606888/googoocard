import { describe, expect, it } from "vitest";
import type { LessonSummary } from "@/store/slices/lessons";
import {
  buildSeries,
  filterSeries,
  sectionByLocation,
  splitSeries,
  termSummary,
  UNCLASSIFIED_KEY,
} from "./lessonSeries";

let nextId = 1;
const lesson = (over: Partial<LessonSummary>): LessonSummary =>
  ({
    id: nextId++,
    name: "L",
    danceStyleId: 1,
    status: "inProgress",
    kind: "fixed",
    groupId: null,
    location: null,
    teachers: [],
    assistants: [],
    totalPeriods: 5,
    attendedCount: 3,
    nextSessionDate: null,
    firstPeriodStart: null,
    lastPeriodEnd: null,
    ...over,
  }) as LessonSummary;

const NO_FILTER = { search: "", danceStyleId: null, locationId: null, teacherId: null };

describe("buildSeries", () => {
  it("numbers a 課種's terms by start date and lists the newest first", () => {
    const first = lesson({ groupId: 7, status: "finished", firstPeriodStart: "2026-07-23T12:00:00Z" });
    const second = lesson({ groupId: 7, firstPeriodStart: "2026-10-15T12:00:00Z" });
    const [series] = buildSeries([second, first], [{ id: 7, name: "Bachata training" }]);
    expect(series.terms.map((t) => [t.lesson.id, t.number])).toEqual([
      [second.id, 2],
      [first.id, 1],
    ]);
    expect(series.lead?.lesson.id).toBe(second.id);
    expect(termSummary(series)).toBe("第 2 期 · 3 / 5 堂");
  });

  it("gives each ungrouped running lesson its own row and pools finished ones", () => {
    const running = lesson({ name: "Salsa" });
    const done = lesson({ status: "finished" });
    const series = buildSeries([running, done], []);
    expect(series.map((s) => s.key)).toEqual([`lesson-${running.id}`, UNCLASSIFIED_KEY]);
    expect(series[0].terms[0].number).toBeNull();
  });

  it("keeps a 課種 with no lessons so a first term can be opened in it", () => {
    const [series] = buildSeries([], [{ id: 1, name: "空的" }]);
    expect(series.lead).toBeNull();
    expect(termSummary(series)).toBe("還沒開過");
  });
});

describe("filterSeries / splitSeries", () => {
  it("matches 我的課 on teachers and assistants of the running term only", () => {
    const mineOld = lesson({ groupId: 1, status: "finished", teachers: [{ id: 9, name: "丁丁" }] as never });
    const othersNow = lesson({ groupId: 1, firstPeriodStart: "2026-10-01T00:00:00Z" });
    const assisting = lesson({ groupId: 2, assistants: [{ id: 9, name: "丁丁" }] as never });
    const series = buildSeries([mineOld, othersNow, assisting], [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    expect(filterSeries(series, { ...NO_FILTER, teacherId: 9 }).map((s) => s.name)).toEqual(["B"]);
  });

  it("searches the 課種 name as well as the lesson and teacher names", () => {
    const series = buildSeries([lesson({ groupId: 1, name: "十月班" })], [{ id: 1, name: "Bachata Lv1" }]);
    expect(filterSeries(series, { ...NO_FILTER, search: "bachata" })).toHaveLength(1);
    expect(filterSeries(series, { ...NO_FILTER, search: "十月" })).toHaveLength(1);
    expect(filterSeries(series, { ...NO_FILTER, search: "salsa" })).toHaveLength(0);
  });

  it("splits running from idle and sorts running by the next session", () => {
    const later = lesson({ name: "later", nextSessionDate: "2026-11-17T12:00:00Z" });
    const sooner = lesson({ name: "sooner", nextSessionDate: "2026-11-12T12:00:00Z" });
    const done = lesson({ status: "finished" });
    const { active, inactive } = splitSeries(buildSeries([later, sooner, done], []));
    expect(active.map((s) => s.name)).toEqual(["sooner", "later"]);
    expect(inactive.map((s) => s.key)).toEqual([UNCLASSIFIED_KEY]);
  });
});

describe("sectionByLocation", () => {
  it("lists a 課種 under every 分部 it runs in, with that 分部's terms only", () => {
    const tainan = { id: 1, name: "台南" };
    const kaohsiung = { id: 2, name: "高雄" };
    const term = (id: number, location: { id: number; name: string } | null) => ({
      lesson: { id, location, status: "inProgress" } as LessonSummary,
      number: id,
    });
    const both = { key: "a", groupId: 1, name: "Bachata", terms: [], active: [term(1, tainan), term(2, kaohsiung)], lead: null };
    const loose = { key: "b", groupId: 2, name: "Salsa", terms: [], active: [term(3, null)], lead: null };
    const sections = sectionByLocation([both, loose], [tainan, kaohsiung]);
    expect(sections.map((s) => [s.location?.name ?? null, s.series.map((x) => x.lead!.lesson.id)])).toEqual([
      ["台南", [1]],
      ["高雄", [2]],
      [null, [3]],
    ]);
  });
});
