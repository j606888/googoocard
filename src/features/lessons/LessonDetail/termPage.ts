import type { LessonKind } from "@/lib/lessonKind";
import type { Period } from "@/store/slices/lessons";

/** 「這一期」頁的純推導：三格統計、時段時間軸要露出哪幾堂。 */

/** 目前這一堂之前最多露出幾堂已上的；更早的收起來。 */
export const EARLIER_SHOWN = 3;
/** 目前這一堂之後最多露出幾堂；持續開課的課會預排很多堂。 */
export const LATER_SHOWN = 4;

export interface TermOverview {
  /** 「2 / 6」（固定堂數）或「6 堂」（持續開課）。 */
  sessions: string;
  /** 「6.5 人」；還沒點過名是「—」。 */
  average: string;
}

export const termOverview = (
  periods: Pick<Period, "attendanceTakenAt">[],
  /** 已點名時段的出席人數。 */
  headcounts: number[],
  kind: LessonKind
): TermOverview => {
  const taken = periods.filter((period) => period.attendanceTakenAt).length;
  const average =
    headcounts.length > 0 ? headcounts.reduce((sum, n) => sum + n, 0) / headcounts.length : null;
  return {
    sessions: kind === "fixed" ? `${taken} / ${periods.length}` : `${taken} 堂`,
    average: average === null ? "—" : `${Number(average.toFixed(1))} 人`,
  };
};

export interface Timeline<P> {
  /** 醒目的那張卡：今天還沒點名的那一堂，沒有才是第一個還沒點名的。 */
  focusId: number | null;
  /** 由舊到新，已經照 `showEarlier`／`showLater` 收合過。 */
  rows: { period: P; number: number }[];
  earlierHidden: number;
  laterHidden: number;
}

/**
 * 時段時間軸：由舊到新，像一期課的進度。課一長（持續開課上了三十堂）就不能全攤開——
 * 以醒目的那一堂為中心，往前留 3 堂、往後留 4 堂，其餘收在「更早／之後」裡。
 * 全部都點過名時，中心是最後一堂。
 *
 * 醒目的那一堂是**今天還沒點名的**，沒有才 fallback 到第一個還沒點名的——跟
 * `dueForAttendancePeriodId` 同一個規則：一堂忘記點的舊時段不該把今天的課擠成沒有按鈕的一列。
 */
export const buildTimeline = <
  P extends Pick<Period, "id" | "attendanceTakenAt"> & { startTime?: Period["startTime"] },
>(
  periods: P[],
  {
    showEarlier = false,
    showLater = false,
    now,
  }: { showEarlier?: boolean; showLater?: boolean; /** 給了才會優先挑今天的那一堂。 */ now?: Date } = {}
): Timeline<P> => {
  const numbered = periods.map((period, index) => ({ period, number: index + 1 }));
  const todayIndex = now
    ? periods.findIndex(
        (period) =>
          !period.attendanceTakenAt &&
          period.startTime !== undefined &&
          new Date(period.startTime).toDateString() === now.toDateString()
      )
    : -1;
  const focusIndex =
    todayIndex !== -1 ? todayIndex : periods.findIndex((period) => !period.attendanceTakenAt);
  const center = focusIndex === -1 ? periods.length : focusIndex;
  const from = showEarlier ? 0 : Math.max(0, center - EARLIER_SHOWN);
  const to = showLater ? periods.length : Math.min(periods.length, center + 1 + LATER_SHOWN);
  return {
    focusId: focusIndex === -1 ? null : periods[focusIndex].id,
    rows: numbered.slice(from, to),
    earlierHidden: from,
    laterHidden: periods.length - to,
  };
};
