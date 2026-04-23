import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: {
        classroomId: classroomId!,
      },
      attendanceTakenAt: {
        not: null,
      },
      attendanceRecords: {
        some: {},
      },
    },
    select: {
      attendanceTakenAt: true,
    },
    orderBy: {
      attendanceTakenAt: "desc",
    },
  });

  const availableDates = [...new Set(periods
    .map((period) => period.attendanceTakenAt)
    .filter((value): value is Date => value !== null)
    .map((value) => toDateKey(value)))];

  if (!date) {
    return NextResponse.json({ availableDates });
  }

  const { start, end } = getDayRange(date);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      lessonPeriod: {
        lesson: {
          classroomId: classroomId!,
        },
        attendanceTakenAt: {
          gte: start,
          lt: end,
        },
      },
    },
    include: {
      student: true,
      studentCard: true,
      lessonPeriod: {
        include: {
          lesson: true,
        },
      },
    },
  });

  const lessonMap = new Map<number, {
    lessonId: number;
    lessonName: string;
    income: number;
    pendingStudents: string[];
  }>();

  for (const record of records) {
    const lessonId = record.lessonPeriod.lessonId;
    const lessonName = record.lessonPeriod.lesson.name;

    if (!lessonMap.has(lessonId)) {
      lessonMap.set(lessonId, {
        lessonId,
        lessonName,
        income: 0,
        pendingStudents: [],
      });
    }

    const lessonData = lessonMap.get(lessonId)!;

    if (record.studentCard) {
      lessonData.income +=
        record.studentCard.finalPrice / record.studentCard.totalSessions;
    } else {
      lessonData.pendingStudents.push(record.student.name);
    }
  }

  const lessons = [...lessonMap.values()]
    .map((lessonData) => ({
      ...lessonData,
      pendingStudents: [...new Set(lessonData.pendingStudents)],
    }))
    .sort((a, b) => b.income - a.income);

  const totalIncome = lessons.reduce((sum, lesson) => sum + lesson.income, 0);

  return NextResponse.json({
    date,
    availableDates,
    totalIncome,
    lessons,
  });
}
