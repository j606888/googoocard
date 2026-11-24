import { describe, it, expect } from "vitest";
import type { AgendaPeriod } from "@/store/slices/lessons";
import {
  buildToday,
  countToday,
  greeting,
  heroBadge,
  termProgressLabel,
  todoRows,
} from "./today";

// 本地時間，跟畫面一樣用瀏覽器時區算「今天」。
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const NOW = at(26, 18, 48);

let nextId = 1;
const period = (
  start: Date,
  {
    taken = false,
    teacherIds = [1],
    assistantIds = [],
    minutes = 60,
    lesson = {},
  }: {
    taken?: boolean;
    teacherIds?: number[];
    assistantIds?: number[];
    minutes?: number;
    lesson?: Partial<AgendaPeriod["lesson"]>;
  } = {}
): AgendaPeriod => ({
  id: nextId++,
  startTime: start.toISOString(),
  endTime: new Date(start.getTime() + minutes * 60_000).toISOString(),
  attendanceTakenAt: taken ? start.toISOString() : null,
  number: 3,
  attendeeIds: [],
  selfCheckInCount: 0,
  lesson: {
    id: 1,
    name: "Bachata LV1",
    kind: "fixed",
    groupId: 1,
    termNumber: 6,
    danceStyle: { id: 1, name: "Bachata", color: "green", abbreviation: null, hasLevels: true },
    location: null,
    teachers: teacherIds.map((id) => ({ id, name: `T${id}` })) as AgendaPeriod["lesson"]["teachers"],
    assistants: assistantIds.map((id) => ({ id, name: `T${id}` })) as AgendaPeriod["lesson"]["assistants"],
    studentCount: 8,
    totalPeriods: 6,
    ...lesson,
  },
});

describe("greeting", () => {
  it("follows the clock", () => {
    expect(greeting(at(26, 8))).toBe("早安");
    expect(greeting(at(26, 14))).toBe("午安");
    expect(greeting(at(26, 19))).toBe("晚安");
    expect(greeting(at(26, 2))).toBe("晚安");
  });
});

describe("buildToday", () => {
  it("makes today's next period the hero and lists the rest of today under it", () => {
    const next = period(at(26, 19, 30));
    const later = period(at(26, 20, 30));
    const tomorrow = period(at(27, 19, 30));
    const view = buildToday([tomorrow, later, next], NOW, 1);
    expect(view.hero?.period.id).toBe(next.id);
    expect(view.heroIsToday).toBe(true);
    expect(view.later.map((r) => r.period.id)).toEqual([later.id]);
    expect(view.overdue).toEqual([]);
  });

  it("prefers a class in session that still needs attendance over the next one", () => {
    const running = period(at(26, 18, 30));
    const next = period(at(26, 19, 30));
    const view = buildToday([next, running], NOW, 1);
    expect(view.hero?.period.id).toBe(running.id);
    expect(view.later.map((r) => r.period.id)).toEqual([next.id]);
  });

  it("keeps an in-session class whose attendance is taken in today's list, not as the hero", () => {
    const running = period(at(26, 18, 30), { taken: true });
    const next = period(at(26, 19, 30));
    const view = buildToday([running, next], NOW, 1);
    expect(view.hero?.period.id).toBe(next.id);
    expect(view.later.map((r) => r.period.id)).toEqual([running.id]);
  });

  it("never offers attendance on the hero when it is not today, and keeps past untaken periods apart", () => {
    const lastWeek = period(at(19, 19, 30));
    const nextWeek = period(at(29, 14, 0));
    const view = buildToday([nextWeek, lastWeek], NOW, 1);
    expect(view.hero?.period.id).toBe(nextWeek.id);
    expect(view.heroIsToday).toBe(false);
    expect(view.later).toEqual([]);
    expect(view.overdue.map((r) => r.period.id)).toEqual([lastWeek.id]);
  });

  it("shows only my lessons (taught or assisted) when I have any, otherwise the whole classroom", () => {
    const others = period(at(26, 19, 0), { teacherIds: [2] });
    const assisted = period(at(26, 20, 30), { teacherIds: [2], assistantIds: [1] });

    const mine = buildToday([others, assisted], NOW, 1);
    expect(mine.scope).toBe("mine");
    expect(mine.hero?.period.id).toBe(assisted.id);
    expect(mine.later).toEqual([]);

    const notTeaching = buildToday([others, assisted], NOW, 9);
    expect(notTeaching.scope).toBe("all");
    expect(notTeaching.hero?.period.id).toBe(others.id);

    expect(buildToday([others], NOW, null).scope).toBe("all");
  });

  it("has no hero when nothing is scheduled", () => {
    expect(buildToday([], NOW, 1)).toMatchObject({ hero: null, heroIsToday: false });
  });
});

describe("labels", () => {
  it("counts down to the start, or to the end while in session", () => {
    const [upcoming] = buildToday([period(at(26, 19, 30))], NOW, 1).later.concat(
      buildToday([period(at(26, 19, 30))], NOW, 1).hero!
    );
    expect(heroBadge(upcoming, NOW)).toBe("下一堂 · 還有 42 分鐘");

    const running = buildToday([period(at(26, 18, 30))], NOW, 1).hero!;
    expect(heroBadge(running, NOW)).toBe("上課中 · 還有 42 分鐘");

    const far = buildToday([period(at(29, 14, 0))], NOW, 1).hero!;
    expect(heroBadge(far, NOW)).toBe("下一堂 · 11/29（日）");
  });

  it("describes the term and session, dropping what the lesson doesn't have", () => {
    expect(termProgressLabel(period(at(26, 19, 30)))).toBe("第 6 期 · 第 3 / 6 堂");
    expect(
      termProgressLabel(period(at(26, 19, 30), { lesson: { kind: "ongoing", termNumber: 1 } }))
    ).toBe("第 1 期 · 第 3 堂");
    expect(
      termProgressLabel(period(at(26, 19, 30), { lesson: { termNumber: null, groupId: null } }))
    ).toBe("第 3 / 6 堂");
  });

  it("counts today's own periods, finished ones included", () => {
    expect(
      countToday(
        [at(26, 9), at(26, 19, 30), at(27, 19, 30)].map((d) => ({ startTime: d.toISOString() })),
        NOW
      )
    ).toBe(2);
  });
});

describe("todoRows", () => {
  const base = {
    unpaidCards: [],
    unpaidDropIns: [],
    unpaidEnrollments: [],
    unboundAttendance: [],
    needsRenewal: [],
    reminderCount: 0,
  };
  const items = (n: number) => Array.from({ length: n }) as never[];

  it("is empty when there is nothing to do", () => {
    expect(todoRows(base)).toEqual([]);
  });

  it("gives each kind its own row, unpaid first, and lumps the remaining reminders", () => {
    expect(
      todoRows({
        ...base,
        unpaidCards: items(1),
        unpaidEnrollments: items(1),
        unboundAttendance: items(2),
        needsRenewal: items(9),
        reminderCount: 11,
      })
    ).toEqual([
      { key: "unpaid", count: 2, text: "筆未付款" },
      { key: "unbound", count: 2, text: "筆點名沒有課卡" },
      { key: "renewal", count: 9, text: "位學生該續卡" },
      { key: "reminders", count: 2, text: "件其他提醒" },
    ]);
  });
});
