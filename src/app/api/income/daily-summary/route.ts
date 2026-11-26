import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { toTaipeiDateKey, parseTaipeiDateRange } from "@/lib/taipei-date";
import { periodRevenue } from "@/lib/income";
import { termRevenueByPeriod } from "@/service/termEnrollment";
import { locationSummarySelect } from "@/lib/locations";
import { parseLocationFilter } from "../locationFilter";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const locationFilter = parseLocationFilter(searchParams);
  if (!locationFilter) {
    return NextResponse.json({ error: "Invalid locationId" }, { status: 400 });
  }

  let selectedDate = dateParam;

  if (!selectedDate) {
    const latestPeriod = await prisma.lessonPeriod.findFirst({
      where: {
        lesson: { classroomId: classroomId!, ...locationFilter },
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
      lesson: { classroomId: classroomId!, ...locationFilter },
      attendanceTakenAt: { not: null },
      startTime: { gte: start, lt: end },
    },
    // Select, never `lesson: true` / `student: true`: the Student row carries
    // `lineBindKey`, `randomKey` and `lineUserId`.
    select: {
      id: true,
      lessonId: true,
      lesson: {
        select: {
          name: true,
          sessionsPerAttendance: true,
          location: { select: locationSummarySelect },
        },
      },
      attendanceRecords: {
        select: {
          studentCardId: true,
          enrollmentId: true,
          sessionsUsed: true,
          student: { select: { name: true } },
          studentCard: { select: { finalPrice: true, totalSessions: true } },
          dropInCharge: { select: { amount: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const term = await termRevenueByPeriod(lessonPeriods.map((p) => p.id));
  const periods = lessonPeriods.map((period) => {
    const termShare = term.get(period.id) ?? { amount: 0, count: 0 };
    const revenue = periodRevenue(period.attendanceRecords) + termShare.amount;

    const pendingStudents = [
      ...new Set(
        period.attendanceRecords
          .filter((record) => record.studentCardId === null && !record.dropInCharge && record.enrollmentId === null)
          .map((record) => record.student.name)
      ),
    ];

    return {
      lessonId: period.lessonId,
      periodId: period.id,
      lessonName: period.lesson.name,
      sessionsPerAttendance: period.lesson.sessionsPerAttendance,
      location: period.lesson.location,
      attendanceCount: period.attendanceRecords.length,
      revenue,
      // 整期攤進這堂的部分（已含在 revenue 裡）：幾個人報整期、共多少。
      termRevenue: termShare.amount,
      termEnrolledCount: termShare.count,
      pendingStudents,
    };
  });

  const totalRevenue = periods.reduce((sum, p) => sum + p.revenue, 0);

  return NextResponse.json({ selectedDate, totalRevenue, periods });
}
