import prisma from "@/lib/prisma";
import { periodRevenue } from "@/lib/income";

/**
 * 「這一期」頁的數字：這門課每個已點名時段的出席人數與收入，加上整期的收入。
 * 沒點名的時段不算（學生自助簽到在老師定案前不算，跟收入頁同一條規則）。
 * 收入走 `periodRevenue()`——跟收入頁、點名完成頁、今天頁的「最近上過」同一支。
 */
export async function getLessonPeriodStats(lessonId: number) {
  const periods = await prisma.lessonPeriod.findMany({
    where: { lessonId, attendanceTakenAt: { not: null } },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    select: {
      id: true,
      attendanceRecords: {
        select: {
          studentCard: { select: { finalPrice: true, totalSessions: true } },
          sessionsUsed: true,
          dropInCharge: { select: { amount: true } },
        },
      },
    },
  });

  const exact = periods.map((period) => ({
    periodId: period.id,
    attendeeCount: period.attendanceRecords.length,
    revenue: periodRevenue(period.attendanceRecords),
  }));

  return {
    periods: exact.map((period) => ({ ...period, revenue: Math.round(period.revenue) })),
    // 先加總再取整：每堂各自四捨五入再加，六堂下來會差到幾塊錢。
    totalRevenue: Math.round(exact.reduce((sum, period) => sum + period.revenue, 0)),
  };
}
