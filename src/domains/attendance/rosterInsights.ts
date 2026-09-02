import { DanceType } from "@prisma/client";
import { canUseCard, type QualifiableCard } from "@/domains/qualification";

// Pure derivations behind the lesson-detail attendance overview. No prisma —
// the same functions run on the server (building the roster payload) and in the
// browser (the chart, the triage list, the roster sort).

/** Tail run of absences that flags a student as drifting away. */
export const CONSECUTIVE_ABSENCE_THRESHOLD = 2;
/** At or below this many spendable sessions the student is due a renewal nudge. */
export const LOW_SESSIONS_THRESHOLD = 1;
/** The triage list is a to-do, not a report — past this it stops being scannable. */
export const MAX_ATTENTION_ROWS = 5;

export type AttendanceStatus = "not_started" | "attended" | "absent";

export type AttendanceCell = {
  /**
   * Rows are joined to periods by id, not by startTime. `LessonPeriod` has only
   * an `@@index([lessonId, startTime])` — no unique — so two periods can share a
   * start time, and a startTime join would collapse them onto one cell.
   */
  periodId: number;
  startTime: string;
  attendanceStatus: AttendanceStatus;
};

/**
 * How much the student can still spend **on this lesson** — deliberately not the
 * same question as the classroom-wide "Needs Renewal" tag
 * (`computeNeedsRenewal` in src/service/studentTag.ts), which is per-card-type
 * and only fires at exactly zero. This one answers "can today's session be
 * charged to a card?". Never label it 需續約.
 */
export type CardStatus = {
  usableSessions: number;
  usableCardCount: number;
  /**
   * Cards attached to this lesson with sessions left that the student may NOT
   * spend — a practice card they are not qualified for. Distinguishes "buy a
   * card" from "grant the qualification".
   */
  blockedCardCount: number;
  level: "ok" | "low" | "none";
};

export type RosterStudent = {
  id: number;
  name: string;
  avatarUrl: string;
  attendances: AttendanceCell[];
  cardStatus: CardStatus;
};

export type InsightPeriod = {
  id: number;
  startTime: string;
  attendanceTakenAt: string | null;
};

export function cardStatusFor(
  studentCards: { remainingSessions: number; card: QualifiableCard }[],
  qualifications: DanceType[],
  lessonDanceType: DanceType
): CardStatus {
  const usable = studentCards.filter((studentCard) =>
    canUseCard(studentCard.card, qualifications, lessonDanceType)
  );
  const usableSessions = usable.reduce(
    (sum, studentCard) => sum + studentCard.remainingSessions,
    0
  );

  return {
    usableSessions,
    usableCardCount: usable.length,
    blockedCardCount: studentCards.length - usable.length,
    level:
      usableSessions === 0
        ? "none"
        : usableSessions <= LOW_SESSIONS_THRESHOLD
        ? "low"
        : "ok",
  };
}

/** Periods sorted the way every view shows them: oldest first, id breaking ties. */
export function sortPeriods<T extends { id: number; startTime: string }>(
  periods: T[]
): T[] {
  return [...periods].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
      a.id - b.id
  );
}

export function cellFor(
  student: { attendances: AttendanceCell[] },
  period: { id: number }
): AttendanceStatus {
  return (
    student.attendances.find((a) => a.periodId === period.id)
      ?.attendanceStatus ?? "not_started"
  );
}

export function attendedCount(cells: AttendanceCell[]): number {
  return cells.filter((c) => c.attendanceStatus === "attended").length;
}

/** Periods that have actually been taken — the denominator for a student's rate. */
export function takenCount(cells: AttendanceCell[]): number {
  return cells.filter((c) => c.attendanceStatus !== "not_started").length;
}

/**
 * Consecutive absences at the end of the student's history. Periods that have
 * not been taken yet are skipped rather than treated as a break, so neither a
 * scheduled future session nor a period inserted retroactively clears the run.
 */
export function trailingAbsenceRun(cells: AttendanceCell[]): number {
  let run = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const status = cells[i].attendanceStatus;
    if (status === "not_started") continue;
    if (status === "absent") {
      run++;
      continue;
    }
    break;
  }
  return run;
}

export function lastAttendedStartTime(cells: AttendanceCell[]): string | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].attendanceStatus === "attended") return cells[i].startTime;
  }
  return null;
}

export type PeriodHeadcount = {
  periodId: number;
  startTime: string;
  taken: boolean;
  attended: number;
  absent: number;
  rosterSize: number;
};

export function headcountByPeriod(
  students: Pick<RosterStudent, "attendances">[],
  periods: InsightPeriod[]
): PeriodHeadcount[] {
  return sortPeriods(periods).map((period) => {
    let attended = 0;
    let absent = 0;
    for (const student of students) {
      const status = cellFor(student, period);
      if (status === "attended") attended++;
      else if (status === "absent") absent++;
    }
    return {
      periodId: period.id,
      startTime: period.startTime,
      taken: Boolean(period.attendanceTakenAt),
      attended,
      absent,
      rosterSize: students.length,
    };
  });
}

export type AttentionKind = "no_card" | "consecutive_absence" | "low_sessions";

export type AttentionItem = {
  student: RosterStudent;
  kind: AttentionKind;
  severity: "danger" | "warning";
  absenceRun: number;
  lastAttendedStartTime: string | null;
  usableSessions: number;
  /** Has a lesson card they cannot spend — the fix is qualification, not a purchase. */
  blockedOnly: boolean;
};

// `no_card` outranks the retention signal because it blocks tonight's 點名,
// while a drifting student is a next-week conversation. `low_sessions` is
// subsumed by `no_card` whenever both apply.
const KIND_ORDER: Record<AttentionKind, number> = {
  no_card: 0,
  consecutive_absence: 1,
  low_sessions: 2,
};

/**
 * One row per student, not one per problem — a student who is both drifting and
 * out of sessions should not eat two slots of a short list. The most urgent
 * reason wins and picks the action; the other facts ride along on the item.
 */
export function attentionItems(students: RosterStudent[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const student of students) {
    const absenceRun = trailingAbsenceRun(student.attendances);
    const lastAttended = lastAttendedStartTime(student.attendances);
    const { usableSessions, level, blockedCardCount } = student.cardStatus;

    // Drifting away presupposes having been here. A student who has never
    // attended is a roster-hygiene question (often someone added mid-course),
    // not churn — flagging them fills the list with false positives in week two.
    const isDrifting =
      absenceRun >= CONSECUTIVE_ABSENCE_THRESHOLD && lastAttended !== null;

    let kind: AttentionKind | null = null;
    if (level === "none") kind = "no_card";
    else if (isDrifting) kind = "consecutive_absence";
    else if (level === "low") kind = "low_sessions";
    if (!kind) continue;

    items.push({
      student,
      kind,
      severity: kind === "low_sessions" ? "warning" : "danger",
      absenceRun,
      lastAttendedStartTime: lastAttended,
      usableSessions,
      blockedOnly: level === "none" && blockedCardCount > 0,
    });
  }

  return items.sort((a, b) => {
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) {
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    }
    if (a.absenceRun !== b.absenceRun) return b.absenceRun - a.absenceRun;
    if (a.usableSessions !== b.usableSessions) {
      return a.usableSessions - b.usableSessions;
    }
    return a.student.name.localeCompare(b.student.name, "zh-Hant");
  });
}

export type RosterSort = "attention" | "rate" | "name";

export type RosterRow = {
  student: RosterStudent;
  cells: { periodId: number; startTime: string; status: AttendanceStatus }[];
  attended: number;
  taken: number;
  absenceRun: number;
  lastAttendedStartTime: string | null;
};

export function buildRosterRows(
  students: RosterStudent[],
  periods: InsightPeriod[]
): RosterRow[] {
  const sorted = sortPeriods(periods);
  return students.map((student) => ({
    student,
    cells: sorted.map((period) => ({
      periodId: period.id,
      startTime: period.startTime,
      status: cellFor(student, period),
    })),
    attended: attendedCount(student.attendances),
    taken: takenCount(student.attendances),
    absenceRun: trailingAbsenceRun(student.attendances),
    lastAttendedStartTime: lastAttendedStartTime(student.attendances),
  }));
}

/** Same ranking the triage list uses, so the two agree about who is worrying. */
function attentionScore(row: RosterRow): number {
  const { level } = row.student.cardStatus;
  let score = 0;
  if (level === "none") score += 100;
  else if (level === "low") score += 50;
  if (
    row.absenceRun >= CONSECUTIVE_ABSENCE_THRESHOLD &&
    row.lastAttendedStartTime !== null
  ) {
    score += 80 + row.absenceRun;
  } else if (row.absenceRun > 0) {
    score += 20;
  }
  return score;
}

export function sortRosterRows(rows: RosterRow[], sort: RosterSort): RosterRow[] {
  const byName = (a: RosterRow, b: RosterRow) =>
    a.student.name.localeCompare(b.student.name, "zh-Hant");

  // Never sort in place: the RTK Query cache array is frozen in development.
  const sorted = [...rows];
  if (sort === "attention") {
    sorted.sort((a, b) => attentionScore(b) - attentionScore(a) || byName(a, b));
  } else if (sort === "rate") {
    // Lowest attendance first — the point of the sort is finding the stragglers.
    sorted.sort(
      (a, b) =>
        a.attended / (a.taken || 1) - b.attended / (b.taken || 1) || byName(a, b)
    );
  } else {
    sorted.sort(byName);
  }
  return sorted;
}

/**
 * Lesson-level rate over periods that were actually taken. The old header maths
 * (LessonDetailHeader) divided by every period including future ones, so a
 * lesson that had barely started reported a depressed rate.
 */
export function lessonAttendanceRate(
  students: Pick<RosterStudent, "attendances">[]
): { attended: number; possible: number; rate: number } {
  let attended = 0;
  let possible = 0;
  for (const student of students) {
    attended += attendedCount(student.attendances);
    possible += takenCount(student.attendances);
  }
  return {
    attended,
    possible,
    rate: possible > 0 ? Math.round((attended / possible) * 100) : 0,
  };
}
