import { differenceInCalendarDays, format, isSameDay, isSameYear } from "date-fns";
import {
  Check,
  CircleDollarSign,
  CircleDot,
  CreditCard,
  Forward,
  Link2,
  Link2Off,
  Repeat2,
  SquareDashed,
  type LucideIcon,
} from "lucide-react";
import { Event } from "@/store/slices/students";

/** 全部／課卡／上課。設計稿還有「資格」「帳號」，目前沒有對應的事件類型。 */
export type EventFilter = "all" | "card" | "lesson";

export const CHECKIN_TITLE = "簽到";
export const EXHAUSTED_TITLE = "課卡使用完畢";
const PURCHASE_TITLE = "購買課卡";
const PAYMENT_TITLE = "確認付款";
const CONVERSION_TITLE = "課卡轉換";
const TRANSFER_TITLE = "課卡轉讓";
// Written by src/service/lineBinding.ts.
const LINE_BOUND_TITLE = "綁定 LINE";
const LINE_UNBOUND_TITLE = "解除 LINE 綁定";
const CARD_TITLES = new Set([PURCHASE_TITLE, PAYMENT_TITLE, EXHAUSTED_TITLE, CONVERSION_TITLE, TRANSFER_TITLE]);

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface EventPresentation {
  icon: LucideIcon;
  /** 圓形圖示底色與文字色 */
  tone: string;
  title: string;
  description: string | null;
}

const TONE = {
  green: "bg-primary-100 text-primary-900",
  pale: "bg-primary-50 text-primary-700",
  grey: "bg-neutral-100 text-neutral-700",
  warm: "bg-warning-100 text-warning-950",
} as const;

/**
 * 一筆事件要怎麼畫：圖示、底色、標題、說明。後端只存 title／description，
 * 顯示用的標題在這裡從 description 推——「Bachata Lv2 簽到成功」→「上課：Bachata Lv2」。
 */
export function presentEvent(event: Event): EventPresentation {
  switch (event.title) {
    case CHECKIN_TITLE: {
      const lesson = event.description.replace(/ ?簽到成功$/, "");
      return { icon: Check, tone: TONE.pale, title: lesson ? `上課：${lesson}` : "上課", description: null };
    }
    case PURCHASE_TITLE:
      return {
        icon: CreditCard,
        tone: TONE.green,
        title: "購買課卡",
        description: event.description.replace(/^購買新課卡 ?/, "").replace(/^學生自助購買課卡 ?/, "學生自購 ") || null,
      };
    case PAYMENT_TITLE:
      return {
        icon: CircleDollarSign,
        tone: TONE.green,
        title: "確認付款",
        description: event.description.replace(/^確認付款 ?/, "") || null,
      };
    case EXHAUSTED_TITLE:
      return {
        icon: SquareDashed,
        tone: TONE.grey,
        title: "課卡用完",
        description: event.description.replace(/^課卡 ?/, "").replace(/ ?使用完畢$/, "") || null,
      };
    case CONVERSION_TITLE:
      return { icon: Repeat2, tone: TONE.warm, title: "課卡轉換", description: event.description || null };
    case TRANSFER_TITLE:
      return { icon: Forward, tone: TONE.pale, title: "課卡轉讓", description: event.description || null };
    case LINE_BOUND_TITLE:
      return { icon: Link2, tone: TONE.green, title: "綁定 LINE", description: event.description || null };
    case LINE_UNBOUND_TITLE:
      return { icon: Link2Off, tone: TONE.grey, title: "解除 LINE 綁定", description: event.description || null };
    default:
      return { icon: CircleDot, tone: TONE.grey, title: event.title, description: event.description || null };
  }
}

export function filterByCategory(events: Event[], filter: EventFilter): Event[] {
  if (filter === "all") return events;
  if (filter === "lesson") return events.filter((e) => e.title === CHECKIN_TITLE);
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

/** 「10 月 8 日 週三」；不是今年的帶年份。 */
export function dayLabel(value: Date | string | number, now = new Date()): string {
  const date = new Date(value);
  const base = `${format(date, "M 月 d 日")} 週${WEEKDAYS[date.getDay()]}`;
  return isSameYear(date, now) ? base : `${format(date, "yyyy 年 ")}${base}`;
}

/** 「今天」「昨天」「5 天前」；超過 30 天不標。 */
export function relativeDayLabel(value: Date | string | number, now = new Date()): string | null {
  const days = differenceInCalendarDays(now, new Date(value));
  if (days < 0 || days > 30) return null;
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

export interface TimelineGroup {
  /** yyyy-MM-dd，分組用 */
  key: string;
  dayLabel: string;
  relative: string | null;
  rows: TimelineRow[];
}

// Rows arrive already desc-sorted, so same-day rows are always contiguous —
// a single linear pass is enough to group them.
export function groupByDay(rows: TimelineRow[], now = new Date()): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  rows.forEach((row) => {
    const anchorEvent = "checkin" in row ? row.checkin : row;
    const key = format(new Date(anchorEvent.createdAt), "yyyy-MM-dd");
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.rows.push(row);
    } else {
      groups.push({
        key,
        dayLabel: dayLabel(anchorEvent.createdAt, now),
        relative: relativeDayLabel(anchorEvent.createdAt, now),
        rows: [row],
      });
    }
  });
  return groups;
}
