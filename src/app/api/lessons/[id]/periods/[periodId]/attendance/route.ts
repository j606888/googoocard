import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";
import { Prisma, StudentCard } from "@prisma/client";

type LessonWithCards = Prisma.LessonGetPayload<{
  include: {
    cards: true;
  };
}>;

type StudentWithCards = Prisma.StudentGetPayload<{
  include: {
    studentCards: true;
  };
}>;

const UNCHECK_TYPE = {
  NO_CARD: "no_card",
  MULTIPLE_CARDS: "multiple_cards",
  NOT_CHECKED: "not_checked",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  const { periodId } = await params;

  const lessonPeriod = await prisma.lessonPeriod.findUnique({
    where: { id: parseInt(periodId) },
    include: {
      attendanceRecords: {
        include: {
          student: {
            include: {
              studentCards: {
                where: {
                  remainingSessions: {
                    gt: 0,
                  },
                },
              },
            },
          },
          studentCard: {
            where: {
              remainingSessions: {
                gt: 0,
              },
              expiredAt: null,
            },
            include: {
              card: true,
            },
          },
        },
      },
    },
  });

  if (!lessonPeriod) {
    return NextResponse.json(
      { error: "Lesson period not found" },
      { status: 404 }
    );
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonPeriod.lessonId },
    include: {
      cards: true,
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const attendanceRecords = lessonPeriod?.attendanceRecords.map((record) => {
    const studentCard = record.studentCard;
    let studentCardData = {};

    if (studentCard) {
      studentCardData = {
        cardId: studentCard.cardId,
        cardName: studentCard.card.name,
        remainingSessions: studentCard.remainingSessions,
        income: studentCard.finalPrice / studentCard.totalSessions,
      };
    } else {
      const uncheckedType = findUncheckedType(lesson, record.student);
      studentCardData = {
        uncheckedType,
      };
    }

    return {
      studentId: record.studentId,
      studentAvatarUrl: record.student.avatarUrl,
      studentName: record.student.name,
      ...studentCardData,
    };
  });

  return NextResponse.json(attendanceRecords);
}

function findUncheckedType(lesson: LessonWithCards, student: StudentWithCards) {
  const lessonCards = lesson.cards;
  const studentCards = student.studentCards;

  const matchedCards = studentCards.filter((studentCard) =>
    lessonCards.some((lessonCard) => lessonCard.cardId === studentCard.cardId)
  );

  if (matchedCards.length === 0) {
    return UNCHECK_TYPE.NO_CARD;
  } else if (matchedCards.length === 1) {
    return UNCHECK_TYPE.NOT_CHECKED;
  } else {
    return UNCHECK_TYPE.MULTIPLE_CARDS;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  const { id, periodId } = await params;
  const { studentIds } = await request.json();

  const lessonPeriod = await prisma.lessonPeriod.findUnique({
    where: { id: parseInt(periodId) },
  });
  const lesson = await prisma.lesson.findUnique({
    where: { id: parseInt(id) },
    include: {
      cards: true,
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  if (!lessonPeriod) {
    return NextResponse.json(
      { error: "Lesson period not found" },
      { status: 404 }
    );
  }

  if (lessonPeriod.attendanceTakenAt) {
    return NextResponse.json(
      { error: "Attendance already taken" },
      { status: 400 }
    );
  }

  const validCardIds = lesson.cards.map((card) => card.cardId);
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
    },
    include: {
      studentCards: {
        where: {
          cardId: { in: validCardIds },
          remainingSessions: {
            gt: 0,
          },
          expiredAt: null,
        },
        include: {
          card: true,
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const student of students) {
      let studentCard: StudentCard | null = null;
      if (student.studentCards.length === 1) {
        studentCard = student.studentCards[0];
      }
      await tx.lessonStudent.upsert({
        where: {
          lessonId_studentId: {
            lessonId: lesson.id,
            studentId: student.id,
          },
        },
        update: {},
        create: {
          lessonId: lesson.id,
          studentId: student.id,
        },
      });

      const attendanceRecord = await tx.attendanceRecord.create({
        data: {
          lessonPeriodId: lessonPeriod.id,
          studentId: student.id,
          studentCardId: studentCard?.id,
        },
      });

      await tx.event.create({
        data: {
          title: "簽到",
          description: `${lesson.name} 簽到成功`,
          studentId: student.id,
          resourceType: "attendanceRecord",
          resourceId: attendanceRecord.id,
        },
      });

      if (studentCard) {
        const updatedStudentCard = await tx.studentCard.update({
          where: { id: studentCard.id },
          data: {
            remainingSessions: {
              decrement: 1,
            },
          },
          include: {
            card: true,
          },
        });

        if (updatedStudentCard.remainingSessions === 0) {
          await tx.event.create({
            data: {
              title: "課卡使用完畢",
              description: `課卡 ${updatedStudentCard.card.name} 使用完畢`,
              studentId: student.id,
              resourceType: "studentCard",
              resourceId: updatedStudentCard.id,
            },
          });
        }
      }
    }

    await tx.lessonPeriod.update({
      where: { id: lessonPeriod.id },
      data: {
        attendanceTakenAt: new Date(),
      },
    });
  });

  await refreshLesson(parseInt(id));

  return NextResponse.json({ success: true });
}
