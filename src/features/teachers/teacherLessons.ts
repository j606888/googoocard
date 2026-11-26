import { format } from "date-fns";

/**
 * 老師頁「這個人教哪些課」的文字（純推導，列表與細節頁共用）。
 * 時段一律用課程「現在」的時段——下一堂，沒有就最近一堂——不是開課第一堂。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 列表一個人一組最多列幾堂，其餘收成「還有 N 門」。 */
export const LESSONS_SHOWN = 3;

/** 「週四 20:30」；沒有時段回 null。 */
export function slotLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return `週${WEEKDAYS[date.getDay()]} ${format(date, "HH:mm")}`;
}

/** 課名後面那串：「週四 20:30 · 台南」。分部只在教室有兩個以上分部時才寫。 */
export function lessonMeta(
  lesson: { slotStart: string | null; location: { name: string } | null },
  showLocation: boolean
): string {
  return [slotLabel(lesson.slotStart) ?? "還沒排時段", showLocation ? lesson.location?.name : null]
    .filter(Boolean)
    .join(" · ");
}

/** 前 `LESSONS_SHOWN` 堂，加上沒列出來的有幾堂。 */
export function capLessons<T>(lessons: readonly T[], limit = LESSONS_SHOWN): { shown: T[]; more: number } {
  return { shown: lessons.slice(0, limit), more: Math.max(0, lessons.length - limit) };
}

/** 細節頁「第 3／8 堂」「已上 12 堂」。 */
export function progressLabel(lesson: { kind: string; taughtCount: number; totalPeriods: number }): string {
  return lesson.kind === "ongoing"
    ? `已上 ${lesson.taughtCount} 堂`
    : `第 ${lesson.taughtCount}／${lesson.totalPeriods} 堂`;
}

/** 「已上 8 堂 · 出席 96 人次 · 42 位學生 · 平均每堂 12 人」——還沒上過課回 null。 */
export function monthSentence(stats: {
  sessions: number;
  attendance: number;
  uniqueStudents: number;
  avgAttendance: number | null;
}): string | null {
  if (stats.sessions === 0) return null;
  return [
    `已上 ${stats.sessions} 堂`,
    `出席 ${stats.attendance} 人次`,
    `${stats.uniqueStudents} 位學生`,
    stats.avgAttendance === null ? null : `平均每堂 ${stats.avgAttendance} 人`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 「比上個月多 12%」「比上個月少 5%」「跟上個月一樣」；上個月沒有出席回 null。 */
export function attendanceChangeLabel(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "跟上個月一樣";
  return `比上個月${pct > 0 ? "多" : "少"} ${Math.abs(pct)}%`;
}
