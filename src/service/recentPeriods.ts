import prisma from "@/lib/prisma";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { periodRevenue } from "@/lib/income";
import { termRevenueByPeriod } from "@/service/termEnrollment";
import { locationSummarySelect } from "@/lib/locations";

export const RECENT_PERIODS_DEFAULT = 5;
export const RECENT_PERIODS_MAX = 20;

/**
 * 「今天」頁的「最近上過」：這間教室最近點過名的時段，新的在前，
 * 各帶出席人數與這堂收入。收入跟收入頁、點名完成頁同一支 `periodRevenue()`。
 */
export async function getRecentPeriods(classroomId: number, limit = RECENT_PERIODS_DEFAULT) {
  const take = Math.min(Math.max(1, Math.floor(limit) || RECENT_PERIODS_DEFAULT), RECENT_PERIODS_MAX);
  const periods = await prisma.lessonPeriod.findMany({
    where: { lesson: { classroomId }, attendanceTakenAt: { not: null } },
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      attendanceRecords: {
        select: {
          studentCard: { select: { finalPrice: true, totalSessions: true } },
          sessionsUsed: true,
          dropInCharge: { select: { amount: true } },
        },
      },
      lesson: {
        select: {
          id: true,
          name: true,
          danceStyle: { select: danceStyleSummarySelect },
          location: { select: locationSummarySelect },
        },
      },
    },
  });

  const term = await termRevenueByPeriod(periods.map((p) => p.id));
  return periods.map(({ attendanceRecords, ...period }) => ({
    ...period,
    attendeeCount: attendanceRecords.length,
    revenue: Math.round(periodRevenue(attendanceRecords) + (term.get(period.id)?.amount ?? 0)),
  }));
}
