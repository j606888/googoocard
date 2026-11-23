/**
 * 報名整期的純規則（前後端共用）。
 *
 * - 開課時講好整期價與堂數（`Lesson.termPrice` / `termSessions`），兩個一起有或一起 null。
 * - 每位報名的人可以個別改價錢與堂數（舊生半價），預設抄課程的。每堂認列 = price / sessions，
 *   **不管有沒有來**（請假、曠課照算，不退費）。
 * - 一筆報名只涵蓋這門課**前 `sessions` 個時段**（照時間排）。課程的時段數不能超過
 *   `termSessions`——停課就刪掉那堂、另外補排一堂。
 */

export const TERM_PRICE_MAX = 1_000_000;
export const TERM_SESSIONS_MAX = 52;

export function isValidTermPrice(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= TERM_PRICE_MAX;
}

export function isValidTermSessions(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= TERM_SESSIONS_MAX;
}

export type TermInput = { termPrice?: number | null; termSessions?: number | null };

/**
 * 開課／課程設定送來的整期欄位。
 * - `undefined`：沒送（PUT 不動）
 * - `{ termPrice: null, termSessions: null }`：不開放整期
 * - `"invalid"`：只送一半、或數字不合法
 */
export function resolveTermInput(
  input: TermInput
): { termPrice: number | null; termSessions: number | null } | undefined | "invalid" {
  const { termPrice, termSessions } = input;
  if (termPrice === undefined && termSessions === undefined) return undefined;
  if (termPrice === null || termPrice === undefined) {
    return termSessions === null || termSessions === undefined
      ? { termPrice: null, termSessions: null }
      : "invalid";
  }
  if (!isValidTermPrice(termPrice) || !isValidTermSessions(termSessions)) return "invalid";
  return { termPrice, termSessions };
}

/** 每堂價（可能有小數，顯示時再取整）。 */
export function termPerSession(price: number, sessions: number): number {
  return sessions > 0 ? price / sessions : 0;
}

/** 時段數超過整期堂數 → 不准排。沒開整期的課不限。 */
export function exceedsTermSessions(periodCount: number, termSessions: number | null | undefined): boolean {
  return termSessions != null && periodCount > termSessions;
}

/** 第 `periodIndex` 個時段（0 起算）在不在這筆報名涵蓋的範圍內。 */
export function enrollmentCoversIndex(periodIndex: number, enrollment: { sessions: number }): boolean {
  return periodIndex >= 0 && periodIndex < enrollment.sessions;
}

/**
 * 一個點過名的時段，整期攤進來的收入：涵蓋這堂的每筆報名各 price / sessions。
 */
export function termShareForPeriod(
  periodIndex: number,
  enrollments: { price: number; sessions: number }[]
): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const enrollment of enrollments) {
    if (!enrollmentCoversIndex(periodIndex, enrollment)) continue;
    amount += termPerSession(enrollment.price, enrollment.sessions);
    count += 1;
  }
  return { amount, count };
}

/** 整期學生某一堂的狀態。`upcoming` = 還沒點名；`outside` = 不在他報的堂數內。 */
export type TermAttendanceStatus = "present" | "leave" | "absent" | "upcoming" | "outside";

export function termAttendanceStatus({
  periodIndex,
  sessions,
  attendanceTaken,
  attended,
  onLeave,
}: {
  periodIndex: number;
  sessions: number;
  attendanceTaken: boolean;
  attended: boolean;
  onLeave: boolean;
}): TermAttendanceStatus {
  if (!enrollmentCoversIndex(periodIndex, { sessions })) return "outside";
  if (attended) return "present";
  if (onLeave) return "leave";
  return attendanceTaken ? "absent" : "upcoming";
}
