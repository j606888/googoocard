import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import { periodRevenue } from "@/lib/income";
import { termRevenueByPeriod } from "@/service/termEnrollment";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect, type LocationSummary } from "@/lib/locations";
import { parseLocationFilter } from "../../locationFilter";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

// 單月課程收入依舞種、依分部拆分 — 收入頁的「依舞種」「依分部」長條。
// 營收算法與 daily-summary 相同（periodRevenue，只算已點名的時段），
// 所以各舞種加總會等於該月每日營收的加總。
// 分部看的是課程的 `locationId`（沒指定的歸在 `location: null`）；`?locationId=<id>|none`
// 只算那個分部的課。課卡收入不分分部——卡片各分部通用，系統也沒記在哪裡買的。
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

  const locationFilter = parseLocationFilter(new URL(request.url).searchParams);
  if (!locationFilter) {
    return NextResponse.json({ error: "Invalid locationId" }, { status: 400 });
  }

  const { start, end } = parseTaipeiMonthRange(month);

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId, ...locationFilter },
      attendanceTakenAt: { not: null },
      startTime: { gte: start, lt: end },
    },
    select: {
      id: true,
      lesson: {
        select: {
          danceStyle: { select: danceStyleSummarySelect },
          location: { select: locationSummarySelect },
        },
      },
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
  // key 0 = 沒指定分部（分部 id 從 1 起跳）。
  const byLoc = new Map<number, { location: LocationSummary | null; revenue: number }>();
  const term = await termRevenueByPeriod(periods.map((p) => p.id));
  for (const period of periods) {
    const revenue = periodRevenue(period.attendanceRecords) + (term.get(period.id)?.amount ?? 0);

    const style = period.lesson.danceStyle;
    const entry = byStyle.get(style.id) ?? { danceStyle: style, revenue: 0 };
    entry.revenue += revenue;
    byStyle.set(style.id, entry);

    const location = period.lesson.location;
    const locEntry = byLoc.get(location?.id ?? 0) ?? { location, revenue: 0 };
    locEntry.revenue += revenue;
    byLoc.set(location?.id ?? 0, locEntry);
  }

  const byDanceStyle = [...byStyle.values()].sort((a, b) => b.revenue - a.revenue);
  const byLocation = [...byLoc.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = byDanceStyle.reduce((sum, s) => sum + s.revenue, 0);

  return NextResponse.json({ month, totalRevenue, byDanceStyle, byLocation });
}
