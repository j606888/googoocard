import type { DanceStyleSummary } from "@/lib/danceStyles";

/** Wire shapes of the LIFF check-in page (src/service/checkin.ts, /api/liff/checkin). */

export interface TodayPeriod {
  periodId: number;
  startTime: string;
  endTime: string;
  alreadyChecked: boolean;
}

export interface UsableCardOption {
  studentCardId: number;
  name: string;
  serialNumber: number;
  remainingSessions: number;
  isPracticeCard: boolean;
}

export interface BuyableCardOption {
  cardId: number;
  name: string;
  sessions: number;
  price: number;
  isPracticeCard: boolean;
}

export interface LessonCardStatus {
  usable: UsableCardOption[];
  autoPickId: number | null;
  buyable: BuyableCardOption[];
}

export interface TodayLesson {
  lessonId: number;
  lessonName: string;
  danceStyle: DanceStyleSummary | null;
  periods: TodayPeriod[];
  cardStatus?: LessonCardStatus;
}

export interface TodayResponse {
  date: string;
  today: TodayLesson[];
  nextLesson: { lessonName: string; startTime: string } | null;
}

export interface CheckinResult {
  periodId: number;
  status: "checked" | "already_checked" | "no_card";
  cardName?: string;
  remainingSessions?: number;
  exhausted?: boolean;
}

export interface CheckinResponse {
  results: CheckinResult[];
  purchased: { id: number; serialNumber: number; name: string; finalPrice: number; isPaid: boolean } | null;
  /** Unpaid total of the card bought in this check-in (0 if none / free). */
  amountDue: number;
  /** Every card this student still owes for, oldest first. */
  unpaidCards: { id: number; serialNumber: number; name: string; finalPrice: number }[];
}

export const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const dateFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "long",
  day: "numeric",
  weekday: "short",
});

/** Group the selected periods by lesson — the check-in APIs take one lesson at a time. */
export function groupSelectedByLesson(
  lessons: TodayLesson[],
  selected: Set<number>
): Map<number, number[]> {
  const byLesson = new Map<number, number[]>();
  lessons.forEach((lesson) => {
    const ids = lesson.periods
      .filter((p) => selected.has(p.periodId))
      .map((p) => p.periodId);
    if (ids.length) byLesson.set(lesson.lessonId, ids);
  });
  return byLesson;
}
