import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DanceType, Prisma } from "@prisma/client";
import {
  takeAttendance,
  updateAttendance,
} from "@/domains/attendance/attendance.service";

type LessonWithCards = Prisma.LessonGetPayload<{
  include: {
    cards: {
      include: {
        card: true,
      },
    };
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
  NOT_QUALIFIED: "not_qualified",
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
      cards: {
        include: {
          card: true,
        },
      }
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
    const studentCard = matchedCards[0];
    const card = lessonCards.find((lessonCard) => lessonCard.cardId === studentCard.cardId)?.card;
    if (card?.isPracticeCard && studentNotQualified(lesson, student)) {
      return UNCHECK_TYPE.NOT_QUALIFIED;
    }
    return UNCHECK_TYPE.NOT_CHECKED;
  } else {
    return UNCHECK_TYPE.MULTIPLE_CARDS;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const { id, periodId } = await params;
    const { studentIds } = await request.json();

    await takeAttendance({
      lessonId: parseInt(id),
      lessonPeriodId: parseInt(periodId),
      studentIds,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Lesson not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === "Lesson period not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === "Attendance already taken") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const { id, periodId } = await params;
    const { studentIds } = await request.json();

    await updateAttendance({
      lessonId: parseInt(id),
      lessonPeriodId: parseInt(periodId),
      studentIds,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Lesson not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === "Lesson period not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function studentNotQualified(lesson: LessonWithCards, student: StudentWithCards) {
  if (lesson.danceType === DanceType.BACHATA && !student.hasCompletedBachataLv1) {
    return true;
  } else if (lesson.danceType === DanceType.SALSA && !student.hasCompletedSalsaLv1) {
    return true;
  }
  return false;
}