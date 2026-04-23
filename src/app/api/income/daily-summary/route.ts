import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

const TAIPEI_OFFSET_MINUTES = 8 * 60;

function toDateKey(date: Date) {
  const localMs = date.getTime() + TAIPEI_OFFSET_MINUTES * 60 * 1000;
  const localDate = new Date(localMs);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day, 0, -TAIPEI_OFFSET_MINUTES, 0, 0)
  );
  const end = new Date(
    Date.UTC(year, month - 1, day + 1, 0, -TAIPEI_OFFSET_MINUTES, 0, 0)
  );
  return { start, end };
}

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const debug = searchParams.get("debug") === "1";

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
      OR: [
        {
          attendanceTakenAt: {
            gte: start,
            lt: end,
          },
        },
        {
          attendanceRecords: {
            some: {
              createdAt: {
                gte: start,
                lt: end,
              },
            },
          },
        },
      ],
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

  if (debug) {
    console.log("[daily-summary] query", {
      selectedDate,
      start: start.toISOString(),
      end: end.toISOString(),
      periodCount: lessonPeriods.length,
    });
    console.log(
      "[daily-summary] periods",
      lessonPeriods.map((period) => ({
        periodId: period.id,
        lessonId: period.lessonId,
        lessonName: period.lesson.name,
        startTime: period.startTime.toISOString(),
        attendanceTakenAt: period.attendanceTakenAt?.toISOString() ?? null,
        attendanceRecords: period.attendanceRecords.map((record) => ({
          attendanceRecordId: record.id,
          studentName: record.student.name,
          createdAt: record.createdAt.toISOString(),
          studentCardId: record.studentCardId,
        })),
      }))
    );
  }

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

  if (debug) {
    const periodKeys = periodSummaries.map((period) => `${period.lessonId}-${period.periodId}`);
    console.log("[daily-summary] period keys", periodKeys);
  }

  return NextResponse.json({
    selectedDate,
    totalRevenue,
    periods: periodSummaries,
  });
}
