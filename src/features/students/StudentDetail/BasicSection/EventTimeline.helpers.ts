import { isSameDay } from "date-fns";
import { Bird, CircleDot, Database, SquareDashed } from "lucide-react";
import { Event } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";

export type EventFilter = "all" | "checkin" | "card";

export const CHECKIN_TITLE = "簽到";
export const EXHAUSTED_TITLE = "課卡使用完畢";
const PURCHASE_TITLE = "購買課卡";
const CARD_TITLES = new Set([PURCHASE_TITLE, EXHAUSTED_TITLE]);

// Shared by EventRow/EventSubRow so the timeline's icon/color vocabulary stays
// in one place (moved from the old Event.tsx).
export const IconMap: Record<string, typeof CircleDot> = {
  [PURCHASE_TITLE]: Database,
  [CHECKIN_TITLE]: Bird,
  [EXHAUSTED_TITLE]: SquareDashed,
};

export const colorMap: Record<string, string> = {
  [PURCHASE_TITLE]: "bg-primary-500",
  [CHECKIN_TITLE]: "bg-warning-500",
  [EXHAUSTED_TITLE]: "bg-neutral-400",
};

export function filterByCategory(events: Event[], filter: EventFilter): Event[] {
  if (filter === "all") return events;
  if (filter === "checkin") return events.filter((e) => e.title === CHECKIN_TITLE);
  return events.filter((e) => CARD_TITLES.has(e.title));
}

export type TimelineRow = Event | { checkin: Event; exhausted: Event };

/**
 * Collapse a "課卡使用完畢" event into a small tag attached to the "簽到"
 * event that caused it, when both happened the same day — this is what turns
 * a single-session-card story (buy → check in → exhausted) from 3 full rows
 * into 2.
 *
 * `events` must already be sorted newest-first (the API's `createdAt desc`
 * order). For each exhausted event we only search FORWARD (higher index,
 * i.e. older-in-time) for its causing check-in: the backend always creates
 * the check-in a moment BEFORE the exhausted event, in the same transaction
 * (see attendance.service.ts's processStudentAttendance), so in a
 * desc-sorted array the cause can only ever sit at a later index — never
 * earlier. Each check-in can be claimed by at most one exhausted event.
 */
export function buildTimelineRows(events: Event[]): TimelineRow[] {
  const claimedCheckinIds = new Set<number>();
  const linkedExhaustedIds = new Set<number>();
  const checkinIdToExhausted = new Map<number, Event>();

  events.forEach((event, i) => {
    if (event.title !== EXHAUSTED_TITLE) return;
    for (let j = i + 1; j < events.length; j++) {
      const candidate = events[j];
      if (candidate.title !== CHECKIN_TITLE) continue;
      if (!isSameDay(new Date(candidate.createdAt), new Date(event.createdAt))) break; // sorted desc — crossing a day means no more same-day candidates
      if (claimedCheckinIds.has(candidate.id)) continue;
      claimedCheckinIds.add(candidate.id);
      checkinIdToExhausted.set(candidate.id, event);
      linkedExhaustedIds.add(event.id);
      break;
    }
  });

  return events
    .filter((event) => !linkedExhaustedIds.has(event.id))
    .map((event) => {
      const exhausted = checkinIdToExhausted.get(event.id);
      return event.title === CHECKIN_TITLE && exhausted
        ? { checkin: event, exhausted }
        : event;
    });
}

export interface TimelineGroup {
  dayLabel: string;
  rows: TimelineRow[];
}

// Rows arrive already desc-sorted, so same-day rows are always contiguous —
// a single linear pass is enough to group them.
export function groupByDay(rows: TimelineRow[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  rows.forEach((row) => {
    const anchorEvent = "checkin" in row ? row.checkin : row;
    const dayLabel = formatDate(anchorEvent.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayLabel === dayLabel) {
      lastGroup.rows.push(row);
    } else {
      groups.push({ dayLabel, rows: [row] });
    }
  });
  return groups;
}
