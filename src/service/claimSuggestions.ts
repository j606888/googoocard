import prisma from "@/lib/prisma";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { bestNameMatch } from "@/lib/nameMatch";

/**
 * 「這是你嗎？」— what a LINE account with no student in this classroom sees first at
 * the door QR (`FirstTimeGate`). Teachers often create students before their first
 * class (整期名單、體驗名單), so instead of making them search, list today's lessons
 * with the people already registered for them who haven't bound a LINE yet:
 *
 * - 整期: a `LessonEnrollment` on that lesson;
 * - 體驗: an unused (remaining > 0) trial card of a trial card that lesson takes;
 * - 預約: a `PeriodBooking` on one of that lesson's periods today (預計會來).
 *
 * Only in-class (not archived), unbound students, and only today's lessons — the user
 * accepted that whoever scans the poster sees today's registered names (2026-11-24),
 * not the whole roster (that still needs a search, `GET /api/liff/claim?q=`).
 * `bestMatchId` is the one whose name looks most like the LINE display name.
 * Binding still goes through `claimStudentLine()` (待處理「LINE 自助認領」).
 */
export interface ClaimSuggestionStudent {
  id: number;
  name: string;
  avatarUrl: string;
  kind: "term" | "trial" | "booked";
}

export interface ClaimSuggestionGroup {
  lessonId: number;
  lessonName: string;
  /** The lesson's first period today. */
  startTime: Date;
  students: ClaimSuggestionStudent[];
}

export interface ClaimSuggestions {
  groups: ClaimSuggestionGroup[];
  bestMatchId: number | null;
}

const studentSelect = { id: true, name: true, avatarUrl: true } as const;
const claimable = { archivedAt: null, lineUserId: null } as const;

export async function todayClaimSuggestions(
  classroomId: number,
  lineName: string,
  now = new Date()
): Promise<ClaimSuggestions> {
  const { start, end } = parseTaipeiDateRange(toTaipeiDateKey(now));
  const lessons = await prisma.lesson.findMany({
    where: { classroomId, endedAt: null, periods: { some: { startTime: { gte: start, lt: end } } } },
    select: {
      id: true,
      name: true,
      periods: {
        where: { startTime: { gte: start, lt: end } },
        orderBy: { startTime: "asc" },
        select: {
          startTime: true,
          bookings: { where: { student: claimable }, select: { student: { select: studentSelect } } },
        },
      },
      enrollments: {
        where: { student: claimable },
        select: { student: { select: studentSelect } },
      },
      cards: {
        where: { card: { isTrial: true } },
        select: {
          card: {
            select: {
              studentCards: {
                where: { remainingSessions: { gt: 0 }, student: claimable },
                select: { student: { select: studentSelect } },
              },
            },
          },
        },
      },
    },
  });

  const groups = lessons
    .map((lesson) => {
      const byId = new Map<number, ClaimSuggestionStudent>();
      for (const { student } of lesson.enrollments) byId.set(student.id, { ...student, kind: "term" });
      for (const lc of lesson.cards) {
        for (const { student } of lc.card.studentCards) {
          if (!byId.has(student.id)) byId.set(student.id, { ...student, kind: "trial" });
        }
      }
      for (const period of lesson.periods) {
        for (const { student } of period.bookings) {
          if (!byId.has(student.id)) byId.set(student.id, { ...student, kind: "booked" });
        }
      }
      return {
        lessonId: lesson.id,
        lessonName: lesson.name,
        startTime: lesson.periods[0].startTime,
        students: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
      };
    })
    .filter((g) => g.students.length > 0)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.lessonId - b.lessonId);

  // Someone in two of today's lessons is one candidate, not a tie with themself.
  const everyone = new Map(groups.flatMap((g) => g.students).map((s) => [s.id, s]));
  const best = bestNameMatch(lineName, [...everyone.values()]);
  return { groups, bestMatchId: best?.id ?? null };
}
