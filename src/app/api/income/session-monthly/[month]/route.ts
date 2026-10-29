import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import { periodRevenue } from "@/lib/income";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

// 單月課程收入依舞種拆分 — 收入頁的「依舞種」長條。
// 營收算法與 daily-summary 相同（periodRevenue，只算已點名的時段），
// 所以各舞種加總會等於該月每日營收的加總。
export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  const { month } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MONTH_KEY.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const { start, end } = parseTaipeiMonthRange(month);

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId },
      attendanceTakenAt: { not: null },
      startTime: { gte: start, lt: end },
    },
    select: {
      lesson: { select: { danceStyle: { select: danceStyleSummarySelect } } },
      attendanceRecords: {
        select: {
          studentCard: { select: { finalPrice: true, totalSessions: true } },
          sessionsUsed: true,
          dropInCharge: { select: { amount: true } },
        },
      },
    },
  });

  const byStyle = new Map<
    number,
    { danceStyle: (typeof periods)[number]["lesson"]["danceStyle"]; revenue: number }
  >();
  for (const period of periods) {
    const style = period.lesson.danceStyle;
    const entry = byStyle.get(style.id) ?? { danceStyle: style, revenue: 0 };
    entry.revenue += periodRevenue(period.attendanceRecords);
    byStyle.set(style.id, entry);
  }

  const byDanceStyle = [...byStyle.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = byDanceStyle.reduce((sum, s) => sum + s.revenue, 0);

  return NextResponse.json({ month, totalRevenue, byDanceStyle });
}
