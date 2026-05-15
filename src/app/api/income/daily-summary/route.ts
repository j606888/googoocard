import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { toTaipeiDateKey, parseTaipeiDateRange } from "@/lib/taipei-date";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  let selectedDate = dateParam;

  if (!selectedDate) {
    const latestPeriod = await prisma.lessonPeriod.findFirst({
      where: {
        lesson: { classroomId: classroomId! },
        attendanceTakenAt: { not: null },
      },
      select: { startTime: true },
      orderBy: { startTime: "desc" },
    });

    if (!latestPeriod) {
      return NextResponse.json({ selectedDate: "", totalRevenue: 0, periods: [] });
    }

    selectedDate = toTaipeiDateKey(latestPeriod.startTime);
  }

  const { start, end } = parseTaipeiDateRange(selectedDate);

  const lessonPeriods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId: classroomId! },
      attendanceTakenAt: { not: null },
      startTime: { gte: start, lt: end },
    },
    include: {
      lesson: true,
      attendanceRecords: {
        include: {
          student: true,
          studentCard: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const periods = lessonPeriods.map((period) => {
    const revenue = period.attendanceRecords.reduce((sum, record) => {
      if (!record.studentCard) return sum;
      return sum + record.studentCard.finalPrice / record.studentCard.totalSessions;
    }, 0);

    const pendingStudents = [
      ...new Set(
        period.attendanceRecords
          .filter((record) => record.studentCardId === null)
          .map((record) => record.student.name)
      ),
    ];

    return {
      lessonId: period.lessonId,
      periodId: period.id,
      lessonName: period.lesson.name,
      attendanceCount: period.attendanceRecords.length,
      revenue,
      pendingStudents,
    };
  });

  const totalRevenue = periods.reduce((sum, p) => sum + p.revenue, 0);

  return NextResponse.json({ selectedDate, totalRevenue, periods });
}
