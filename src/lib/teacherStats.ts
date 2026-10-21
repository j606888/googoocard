import { toTaipeiMonthKey } from "@/lib/taipei-date";

// Pure aggregation behind the teachers pages. Every figure counts only periods
// whose attendance was taken (`attendanceTakenAt` set) — the same rule the
// income page uses — so a self check-in the teacher hasn't confirmed yet, or a
// period nobody marked, never inflates a teacher's numbers.

export type PeriodState = "done" | "pending" | "upcoming";

export type StatPeriod = {
  startTime: Date;
  endTime: Date;
  attendanceTakenAt: Date | null;
  studentIds: number[];
};

export type MonthSummary = {
  /** Periods taught = attendance taken. */
  sessions: number;
  /** Periods already over whose attendance hasn't been taken. */
  pendingCount: number;
  /** Attendance records across the taught periods. */
  attendance: number;
  uniqueStudents: number;
  /** attendance / sessions, one decimal; null when nothing was taught. */
  avgAttendance: number | null;
};

export function periodState(
  period: Pick<StatPeriod, "endTime" | "attendanceTakenAt">,
  now: Date
): PeriodState {
  if (period.attendanceTakenAt) return "done";
  return period.endTime < now ? "pending" : "upcoming";
}

/** "YYYY-MM" moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The `count` months ending at `month`, oldest first. */
export function monthsEndingAt(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
}

export function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizeMonth(periods: StatPeriod[], now: Date): MonthSummary {
  const done = periods.filter((period) => period.attendanceTakenAt);
  const attendance = done.reduce((sum, period) => sum + period.studentIds.length, 0);
  return {
    sessions: done.length,
    pendingCount: periods.filter((period) => periodState(period, now) === "pending").length,
    attendance,
    uniqueStudents: new Set(done.flatMap((period) => period.studentIds)).size,
    avgAttendance: done.length > 0 ? roundOne(attendance / done.length) : null,
  };
}

/** Taught sessions and attendance per month, bucketed by the period's Taipei month. */
export function monthlyTrend(
  periods: StatPeriod[],
  months: string[]
): { month: string; sessions: number; attendance: number }[] {
  const buckets = new Map(months.map((month) => [month, { month, sessions: 0, attendance: 0 }]));
  for (const period of periods) {
    if (!period.attendanceTakenAt) continue;
    const bucket = buckets.get(toTaipeiMonthKey(period.startTime));
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.attendance += period.studentIds.length;
  }
  return months.map((month) => buckets.get(month)!);
}

/** Students who came most often to the taught periods; ties go to the lower id. */
export function topStudents(
  periods: StatPeriod[],
  limit: number
): { studentId: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const period of periods) {
    if (!period.attendanceTakenAt) continue;
    for (const studentId of period.studentIds) {
      counts.set(studentId, (counts.get(studentId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([studentId, count]) => ({ studentId, count }))
    .sort((a, b) => b.count - a.count || a.studentId - b.studentId)
    .slice(0, limit);
}
