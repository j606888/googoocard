import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { periodRevenue } from "@/lib/income";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId: classroomId! },
      attendanceTakenAt: { not: null },
    },
    select: {
      startTime: true,
      attendanceRecords: {
        select: {
          studentCard: { select: { finalPrice: true, totalSessions: true } },
        },
      },
    },
  });

  // 依台北日期分組,加總每日營收
  const totals = new Map<string, number>();
  for (const period of periods) {
    const date = toTaipeiDateKey(period.startTime);
    totals.set(date, (totals.get(date) ?? 0) + periodRevenue(period.attendanceRecords));
  }

  const days = [...totals.entries()]
    .map(([date, totalRevenue]) => ({ date, totalRevenue }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const years = [
    ...new Set(days.map((d) => Number(d.date.slice(0, 4)))),
  ].sort((a, b) => b - a);

  return NextResponse.json({ years, days });
}
