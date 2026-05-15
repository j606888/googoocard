import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { toTaipeiDateKey } from "@/lib/taipei-date";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId: classroomId! },
      attendanceTakenAt: { not: null },
    },
    select: { startTime: true },
    orderBy: { startTime: "desc" },
  });

  const dates = [
    ...new Set(periods.map((period) => toTaipeiDateKey(period.startTime))),
  ].sort((a, b) => b.localeCompare(a));

  const years = [
    ...new Set(dates.map((date) => Number(date.slice(0, 4)))),
  ].sort((a, b) => b - a);

  return NextResponse.json({ years, dates });
}
