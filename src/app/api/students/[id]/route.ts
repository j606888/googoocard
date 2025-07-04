import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id: parseInt(id) },
    include: {
      lessons: true,
      studentCards: {
        include: {
          card: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      attendanceRecords: {
        include: {
          lessonPeriod: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }
    }
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const lastAttendance = await prisma.attendanceRecord.findFirst({
    where: {
      studentId: parseInt(id),
    },
    include: {
      lessonPeriod: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const overview = {
    lastAttendAt: lastAttendance?.lessonPeriod.attendanceTakenAt,
    attendLessonCount: student.lessons.length,
    cardCount: student.studentCards.length,
    totalSpend: student.studentCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: student.studentCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lessons: _unusedLessons, attendanceRecords, ...studentData } = student;

  const attendLessonIds = [...new Set(attendanceRecords.map((record) => record.lessonPeriod.lessonId))]
  const lessons = await prisma.lesson.findMany({
    where: {
      id: {
        in: attendLessonIds,
      },
    },
    include: {
      periods: {
        orderBy: {
          startTime: "asc",
        },
      }
    }
  })

  const attendancesByLesson = lessons.map((lesson) => {
    return {
      lessonId: lesson.id,
      lessonName: lesson.name,
      totalPeriods: lesson.periods.length,
      lessonPeriodIds: lesson.periods.map((period) => period.id),
      attendances: [] as {
        periodStartTime: Date;
        periodNumber: number;
        totalPeriods: number;
      }[],
    }
  })

  const attendancesByDate = {} as {
    [dateKey: string]: {
      date: number;
      attendances: {
        lessonName: string;
        periodNumber: number;
        totalPeriods: number
      }[]
    }
  }


  attendanceRecords.forEach((record) => {
    const lessonId = record.lessonPeriod.lessonId;
    const lessonPeriodId = record.lessonPeriod.id;
    const periodStartTime = record.lessonPeriod.startTime;

    const lesson = lessons.find((lesson) => lesson.id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    const attendanceData = {
      periodStartTime,
      periodNumber: lesson.periods.findIndex((period) => period.id === lessonPeriodId) + 1,
      totalPeriods: lesson.periods.length,
    }
    attendancesByLesson.find((lesson) => lesson.lessonId === lessonId)?.attendances.push(attendanceData);
  })


  attendancesByLesson.forEach((lesson) => {
    lesson.attendances.forEach((attendance) => {
      const dateKey = formatDate(attendance.periodStartTime.getTime());
      if (!attendancesByDate[dateKey]) {
        attendancesByDate[dateKey] = {
          date: attendance.periodStartTime.getTime(),
          attendances: [
            {
              lessonName: lesson.lessonName,
              periodNumber: attendance.periodNumber,
              totalPeriods: lesson.totalPeriods,
            }
          ],
        }
      } else {
        attendancesByDate[dateKey].attendances.push({
          lessonName: lesson.lessonName,
          periodNumber: attendance.periodNumber,
          totalPeriods: lesson.totalPeriods,
        })
      }
    })
  })

  const sortedAttendancesByDate = Object.values(attendancesByDate).sort((a, b) => b.date - a.date);

  return NextResponse.json({
    overview,
    attendancesByDate: sortedAttendancesByDate,
    attendancesByLesson,
    ...studentData,
  });
}
