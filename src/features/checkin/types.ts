import { DanceType } from "@prisma/client";

/** Wire shapes shared by the LIFF check-in page and the public QR check-in page. */

export interface TodayPeriod {
  periodId: number;
  startTime: string;
  endTime: string;
  alreadyChecked: boolean;
}

export interface TodayLesson {
  lessonId: number;
  lessonName: string;
  danceType: DanceType;
  periods: TodayPeriod[];
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
