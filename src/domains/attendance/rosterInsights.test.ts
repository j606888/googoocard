import { describe, expect, it } from "vitest";
import { DanceType } from "@prisma/client";
import {
  attentionItems,
  buildRosterRows,
  cardStatusFor,
  headcountByPeriod,
  lastAttendedStartTime,
  lessonAttendanceRate,
  sortRosterRows,
  trailingAbsenceRun,
  type AttendanceCell,
  type AttendanceStatus,
  type CardStatus,
  type InsightPeriod,
  type RosterStudent,
} from "./rosterInsights";

const period = (id: number, startTime: string, taken = true): InsightPeriod => ({
  id,
  startTime,
  attendanceTakenAt: taken ? "2026-08-30T12:00:00.000Z" : null,
});

const cells = (
  periods: InsightPeriod[],
  statuses: AttendanceStatus[]
): AttendanceCell[] =>
  periods.map((p, i) => ({
    periodId: p.id,
    startTime: p.startTime,
    attendanceStatus: statuses[i],
  }));

const okCards = (sessions: number): CardStatus => ({
  usableSessions: sessions,
  usableCardCount: sessions > 0 ? 1 : 0,
  blockedCardCount: 0,
  level: sessions === 0 ? "none" : sessions <= 1 ? "low" : "ok",
});

const student = (
  id: number,
  name: string,
  attendances: AttendanceCell[],
  cardStatus: CardStatus = okCards(5)
): RosterStudent => ({
  id,
  name,
  avatarUrl: "",
  attendances,
  cardStatus,
});

const P = [
  period(1, "2026-08-02T12:00:00.000Z"),
  period(2, "2026-08-09T12:00:00.000Z"),
  period(3, "2026-08-16T12:00:00.000Z"),
];

describe("trailingAbsenceRun", () => {
  it("counts absences at the tail only", () => {
    expect(trailingAbsenceRun(cells(P, ["attended", "absent", "absent"]))).toBe(2);
    expect(trailingAbsenceRun(cells(P, ["absent", "absent", "attended"]))).toBe(0);
    expect(trailingAbsenceRun(cells(P, ["attended", "attended", "absent"]))).toBe(1);
  });

  it("skips periods that have not been taken instead of breaking the run", () => {
    // A scheduled future session must not clear the flag …
    expect(
      trailingAbsenceRun(cells(P, ["absent", "absent", "not_started"]))
    ).toBe(2);
    // … and neither must a period inserted retroactively between two taken ones.
    expect(
      trailingAbsenceRun(cells(P, ["absent", "not_started", "absent"]))
    ).toBe(2);
  });

  it("is zero for an empty history", () => {
    expect(trailingAbsenceRun([])).toBe(0);
    expect(trailingAbsenceRun(cells(P, ["not_started", "not_started", "not_started"]))).toBe(0);
  });
});

describe("lastAttendedStartTime", () => {
  it("returns the most recent attended period", () => {
    expect(
      lastAttendedStartTime(cells(P, ["attended", "attended", "absent"]))
    ).toBe("2026-08-09T12:00:00.000Z");
  });

  it("returns null when the student has never attended", () => {
    expect(lastAttendedStartTime(cells(P, ["absent", "absent", "absent"]))).toBeNull();
  });
});

describe("headcountByPeriod", () => {
  it("counts attendance per period and keeps periods with the same startTime apart", () => {
    // No unique on (lessonId, startTime) — two periods can genuinely collide.
    const collide = [
      period(10, "2026-08-02T12:00:00.000Z"),
      period(11, "2026-08-02T12:00:00.000Z"),
    ];
    const roster = [
      student(1, "甲", cells(collide, ["attended", "absent"])),
      student(2, "乙", cells(collide, ["absent", "attended"])),
    ];

    const counts = headcountByPeriod(roster, collide);

    expect(counts).toHaveLength(2);
    expect(counts[0]).toMatchObject({ periodId: 10, attended: 1, absent: 1 });
    expect(counts[1]).toMatchObject({ periodId: 11, attended: 1, absent: 1 });
  });

  it("marks periods that have not been taken and counts nobody for them", () => {
    const periods = [period(1, "2026-08-02T12:00:00.000Z", false)];
    const counts = headcountByPeriod(
      [student(1, "甲", cells(periods, ["not_started"]))],
      periods
    );
    expect(counts[0]).toMatchObject({ taken: false, attended: 0, absent: 0, rosterSize: 1 });
  });

  it("handles an empty roster without dividing by zero", () => {
    const counts = headcountByPeriod([], P);
    expect(counts).toHaveLength(3);
    expect(counts.every((c) => c.rosterSize === 0 && c.attended === 0)).toBe(true);
  });

  it("handles a lesson with no periods", () => {
    expect(headcountByPeriod([student(1, "甲", [])], [])).toEqual([]);
  });

  it("orders periods oldest first regardless of input order", () => {
    const counts = headcountByPeriod([], [P[2], P[0], P[1]]);
    expect(counts.map((c) => c.periodId)).toEqual([1, 2, 3]);
  });
});

describe("cardStatusFor", () => {
  const general = { isPracticeCard: false, danceType: null };
  const bachataPractice = { isPracticeCard: true, danceType: DanceType.BACHATA };

  it("sums remaining sessions across usable cards", () => {
    expect(
      cardStatusFor(
        [
          { remainingSessions: 3, card: general },
          { remainingSessions: 2, card: general },
        ],
        [],
        DanceType.BACHATA
      )
    ).toMatchObject({ usableSessions: 5, usableCardCount: 2, level: "ok" });
  });

  it("excludes a practice card the student is not qualified for, and counts it as blocked", () => {
    expect(
      cardStatusFor(
        [{ remainingSessions: 4, card: bachataPractice }],
        [],
        DanceType.BACHATA
      )
    ).toMatchObject({
      usableSessions: 0,
      usableCardCount: 0,
      blockedCardCount: 1,
      level: "none",
    });
  });

  it("counts the same practice card once the student is qualified", () => {
    expect(
      cardStatusFor(
        [{ remainingSessions: 4, card: bachataPractice }],
        [DanceType.BACHATA],
        DanceType.BACHATA
      )
    ).toMatchObject({ usableSessions: 4, usableCardCount: 1, blockedCardCount: 0 });
  });

  it("flags exactly one remaining session as low and two as ok", () => {
    expect(cardStatusFor([{ remainingSessions: 1, card: general }], [], DanceType.BACHATA).level).toBe("low");
    expect(cardStatusFor([{ remainingSessions: 2, card: general }], [], DanceType.BACHATA).level).toBe("ok");
  });

  it("reports none for a student holding nothing", () => {
    expect(cardStatusFor([], [], DanceType.BACHATA)).toMatchObject({
      usableSessions: 0,
      blockedCardCount: 0,
      level: "none",
    });
  });
});

describe("attentionItems", () => {
  it("flags a drifting student who used to attend", () => {
    const items = attentionItems([
      student(1, "陳雅婷", cells(P, ["attended", "absent", "absent"])),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "consecutive_absence", absenceRun: 2 });
  });

  it("does not flag a student who has never attended this lesson", () => {
    // Typically someone added to the roster mid-course: the payload renders every
    // prior period as `absent`, which is not the same thing as drifting away.
    expect(
      attentionItems([student(1, "新同學", cells(P, ["absent", "absent", "absent"]))])
    ).toEqual([]);
  });

  it("does not flag a single absence", () => {
    expect(
      attentionItems([student(1, "甲", cells(P, ["attended", "attended", "absent"]))])
    ).toEqual([]);
  });

  it("emits one row per student, with no_card winning over a drift", () => {
    const items = attentionItems([
      student(1, "甲", cells(P, ["attended", "absent", "absent"]), okCards(0)),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("no_card");
    // The drift is still reported on the item so the row can mention it.
    expect(items[0].absenceRun).toBe(2);
  });

  it("marks a student blocked only by qualification separately from an empty wallet", () => {
    const blocked: CardStatus = {
      usableSessions: 0,
      usableCardCount: 0,
      blockedCardCount: 1,
      level: "none",
    };
    const items = attentionItems([student(1, "甲", cells(P, ["attended", "attended", "attended"]), blocked)]);
    expect(items[0]).toMatchObject({ kind: "no_card", blockedOnly: true });

    const empty = attentionItems([student(2, "乙", cells(P, ["attended", "attended", "attended"]), okCards(0))]);
    expect(empty[0]).toMatchObject({ kind: "no_card", blockedOnly: false });
  });

  it("orders no_card, then drift, then low sessions", () => {
    const items = attentionItems([
      student(3, "丙", cells(P, ["attended", "attended", "attended"]), okCards(1)),
      student(2, "乙", cells(P, ["attended", "absent", "absent"])),
      student(1, "甲", cells(P, ["attended", "attended", "attended"]), okCards(0)),
    ]);
    expect(items.map((i) => i.kind)).toEqual([
      "no_card",
      "consecutive_absence",
      "low_sessions",
    ]);
  });

  it("returns nothing for an empty roster or a lesson that has not started", () => {
    expect(attentionItems([])).toEqual([]);
    expect(
      attentionItems([
        student(1, "甲", cells(P, ["not_started", "not_started", "not_started"])),
      ])
    ).toEqual([]);
  });
});

describe("buildRosterRows / sortRosterRows", () => {
  const roster = [
    student(1, "王柏宇", cells(P, ["attended", "attended", "attended"])),
    student(2, "陳雅婷", cells(P, ["attended", "absent", "absent"])),
    student(3, "許博鈞", cells(P, ["attended", "attended", "attended"]), okCards(0)),
  ];

  it("builds one cell per period in chronological order", () => {
    const rows = buildRosterRows(roster, [P[2], P[0], P[1]]);
    expect(rows[0].cells.map((c) => c.periodId)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ attended: 3, taken: 3, absenceRun: 0 });
    expect(rows[1]).toMatchObject({ attended: 1, taken: 3, absenceRun: 2 });
  });

  it("counts only taken periods towards a student's denominator", () => {
    const periods = [P[0], P[1], period(9, "2026-08-23T12:00:00.000Z", false)];
    const rows = buildRosterRows(
      [student(1, "甲", cells(periods, ["attended", "attended", "not_started"]))],
      periods
    );
    expect(rows[0]).toMatchObject({ attended: 2, taken: 2 });
  });

  it("sorts by attention, rate and name without mutating the input", () => {
    const rows = buildRosterRows(roster, P);
    const snapshot = rows.map((r) => r.student.id);

    expect(sortRosterRows(rows, "attention").map((r) => r.student.id)).toEqual([3, 2, 1]);
    expect(sortRosterRows(rows, "rate")[0].student.id).toBe(2);
    expect(sortRosterRows(rows, "name").map((r) => r.student.name)).toEqual([
      "王柏宇",
      "許博鈞",
      "陳雅婷",
    ]);
    expect(rows.map((r) => r.student.id)).toEqual(snapshot);
  });

  it("does not divide by zero when nothing has been taken", () => {
    const periods = [period(1, "2026-08-02T12:00:00.000Z", false)];
    const rows = buildRosterRows(
      [student(1, "甲", cells(periods, ["not_started"]))],
      periods
    );
    expect(() => sortRosterRows(rows, "rate")).not.toThrow();
    expect(rows[0].taken).toBe(0);
  });
});

describe("lessonAttendanceRate", () => {
  it("divides by taken periods, not by every scheduled one", () => {
    const periods = [P[0], P[1], period(9, "2026-08-23T12:00:00.000Z", false)];
    const roster = [
      student(1, "甲", cells(periods, ["attended", "attended", "not_started"])),
      student(2, "乙", cells(periods, ["attended", "absent", "not_started"])),
    ];
    expect(lessonAttendanceRate(roster)).toEqual({
      attended: 3,
      possible: 4,
      rate: 75,
    });
  });

  it("reports zero rather than NaN before the first period is taken", () => {
    expect(
      lessonAttendanceRate([
        student(1, "甲", cells(P, ["not_started", "not_started", "not_started"])),
      ])
    ).toEqual({ attended: 0, possible: 0, rate: 0 });
    expect(lessonAttendanceRate([])).toEqual({ attended: 0, possible: 0, rate: 0 });
  });
});
