import { isSameMonth } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";
import { sessionState } from "./status";

/** Filter key for sessions whose lesson has no dance style. */
export const NO_STYLE_KEY = "none";

export type StyleFilter = number | typeof NO_STYLE_KEY | null;

export const styleKeyOf = (p: CalendarPeriod) => p.danceStyleId ?? NO_STYLE_KEY;

export const filterByStyle = (periods: CalendarPeriod[], filter: StyleFilter) =>
  filter === null ? periods : periods.filter((p) => styleKeyOf(p) === filter);

export interface MonthSummary {
  total: number;
  taken: number;
  /** Attendees across the sessions whose attendance is taken. */
  attendees: number;
  /** Sessions still waiting for attendance, oldest first. */
  due: CalendarPeriod[];
}

/**
 * Counts for the sessions inside `viewMonth` — the grid also fetches the
 * leading/trailing days of the neighbouring months, which are left out here.
 */
export const summarizeMonth = (
  periods: CalendarPeriod[],
  viewMonth: Date,
  now: Date
): MonthSummary => {
  const summary: MonthSummary = { total: 0, taken: 0, attendees: 0, due: [] };
  periods.forEach((p) => {
    if (!isSameMonth(new Date(p.startTime), viewMonth)) return;
    summary.total += 1;
    const state = sessionState(p, now);
    if (state === "taken") {
      summary.taken += 1;
      summary.attendees += p.attendeeCount;
    } else if (state === "due") {
      summary.due.push(p);
    }
  });
  summary.due.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return summary;
};
