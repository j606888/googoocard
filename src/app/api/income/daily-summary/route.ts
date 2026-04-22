import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  let selectedDate = dateParam;

  if (!selectedDate) {
    const latestPeriod = await prisma.lessonPeriod.findFirst({
      where: {
        lesson: {
          classroomId: classroomId!,
        },
        attendanceTakenAt: {
          not: null,
        },
      },
      select: {
        attendanceTakenAt: true,
      },
      orderBy: {
        attendanceTakenAt: "desc",
      },
    });

    if (!latestPeriod?.attendanceTakenAt) {
      return NextResponse.json({
        selectedDate: "",
        totalRevenue: 0,
        periods: [],
      });
    }

    selectedDate = toDateKey(latestPeriod.attendanceTakenAt);
  }

  const { start, end } = parseDateRange(selectedDate);
  const lessonPeriods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: {
        classroomId: classroomId!,
      },
      attendanceTakenAt: {
        gte: start,
        lt: end,
      },
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
    orderBy: {
      startTime: "asc",
    },
  });

  const periodSummaries = lessonPeriods.map((period) => {
    const revenue = period.attendanceRecords.reduce((sum, record) => {
      if (!record.studentCard) {
        return sum;
      }
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

  const totalRevenue = periodSummaries.reduce((sum, item) => sum + item.revenue, 0);

  return NextResponse.json({
    selectedDate,
    totalRevenue,
    periods: periodSummaries,
  });
}
