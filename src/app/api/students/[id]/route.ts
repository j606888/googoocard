import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { decodeAuthToken } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const existingStudent = await prisma.student.findFirst({
    where: {
      name,
      classroomId,
      NOT: {
        id: parseInt(id),
      },
    },
  });

  if (existingStudent) {
    return NextResponse.json({ error: "Student name already exists" }, { status: 400 });
  }

  const student = await prisma.student.update({
    where: { id: parseInt(id) },
    data: { name },
  });

  return NextResponse.json(student);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id: parseInt(id) },
    include: {
      lessons: true,
      classroom: true,
      studentCards: {
        include: {
          card: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      attendanceRecords: {
        include: {
          lessonPeriod: true,
          studentCard: true,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lessons: _unusedLessons, attendanceRecords, studentCards, ...studentData } = student;

  const overview = {
    lastAttendAt: lastAttendance?.lessonPeriod.attendanceTakenAt,
    attendLessonCount: student.lessons.length,
    cardCount: studentCards.length,
    totalSpend: studentCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: studentCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  }

  

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
      studentAttendances: lesson.periods.map((period) => {
        return {
          studentAttend: false,
          periodId: period.id,
          periodStartTime: period.startTime,
          periodAttendantCheck: !!period.attendanceTakenAt
        }
      }),
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

  // Create a map to group attendance records by student card
  const studentCardAttendances = new Map<number, Array<{ lessonName: string; periodStartTime: Date }>>()

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
    const studentAttendance = attendancesByLesson.find((lesson) => lesson.lessonId === lessonId)?.studentAttendances.find((attendance) => attendance.periodId === lessonPeriodId);
    if (studentAttendance) {
      studentAttendance.studentAttend = true
    }
    
    // Group attendance records by student card
    if (record.studentCardId) {
      const cardAttendances = studentCardAttendances.get(record.studentCardId) || [];
      cardAttendances.push({
        lessonName: lesson.name,
        periodStartTime,
      });
      studentCardAttendances.set(record.studentCardId, cardAttendances);
    }
  })

  // Create enhanced student cards with attendance records
  const studentCardsWithAttendances = studentCards.map(card => ({
    ...card,
    attendanceRecords: studentCardAttendances.get(card.id) || []
  }))

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
    studentCards: studentCardsWithAttendances,
    ...studentData,
  });
}
