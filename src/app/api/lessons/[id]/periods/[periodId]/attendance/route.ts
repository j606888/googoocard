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
    studentCards: {
      include: {
        card: true;
      };
    };
  };
}>;

const UNCHECK_TYPE = {
  NO_CARD: "no_card",
  NO_PRACTICE_CARD: "no_practice_card",
  MULTIPLE_CARDS: "multiple_cards",
  NOT_CHECKED: "not_checked",
  NOT_QUALIFIED: "not_qualified",
};

const ATTENDANCE_REASON = {
  PRACTICE_PRIORITY: "PRACTICE_PRIORITY",
} as const;

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
                include: {
                  card: true,
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
      const { uncheckedType, recommendedStudentCardId, reason } =
        findUncheckedType(lesson, record.student);
      studentCardData = {
        uncheckedType,
        recommendedStudentCardId,
        reason,
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
  const matchedCards = getMatchedCards(lesson, student);
  const shouldForcePracticePriority = shouldUsePracticePriority(lesson, student);
  const practicePriorityCard = getPracticePriorityCard(lesson, student, matchedCards);

  if (practicePriorityCard) {
    return {
      uncheckedType: UNCHECK_TYPE.MULTIPLE_CARDS,
      recommendedStudentCardId: practicePriorityCard.id,
      reason: ATTENDANCE_REASON.PRACTICE_PRIORITY,
    };
  }

  if (matchedCards.length === 0) {
    return {
      uncheckedType: UNCHECK_TYPE.NO_CARD,
      recommendedStudentCardId: null,
      reason: null,
    };
  } else if (shouldForcePracticePriority) {
    return {
      uncheckedType: UNCHECK_TYPE.NO_PRACTICE_CARD,
      recommendedStudentCardId: null,
      reason: null,
    };
  } else if (matchedCards.length === 1) {
    const studentCard = matchedCards[0];
    const card = lesson.cards.find(
      (lessonCard) => lessonCard.cardId === studentCard.cardId
    )?.card;
    if (card?.isPracticeCard && studentNotQualified(lesson, student)) {
      return {
        uncheckedType: UNCHECK_TYPE.NOT_QUALIFIED,
        recommendedStudentCardId: null,
        reason: null,
      };
    }
    return {
      uncheckedType: UNCHECK_TYPE.NOT_CHECKED,
      recommendedStudentCardId: studentCard.id,
      reason: null,
    };
  } else {
    const recommendedCard = getRecommendedStudentCard(matchedCards);
    return {
      uncheckedType: UNCHECK_TYPE.MULTIPLE_CARDS,
      recommendedStudentCardId: recommendedCard?.id ?? null,
      reason: null,
    };
  }
}

function shouldUsePracticePriority(lesson: LessonWithCards, student: StudentWithCards) {
  const lessonHasPracticeCard = lesson.cards.some((lessonCard) => lessonCard.card.isPracticeCard);
  if (!lessonHasPracticeCard) {
    return false;
  }
  return !studentNotQualified(lesson, student);
}

function getMatchedCards(lesson: LessonWithCards, student: StudentWithCards) {
  return student.studentCards.filter(
    (studentCard) =>
      studentCard.remainingSessions > 0 &&
      !studentCard.expiredAt &&
      lesson.cards.some((lessonCard) => lessonCard.cardId === studentCard.cardId)
  );
}

function getPracticePriorityCard(
  lesson: LessonWithCards,
  student: StudentWithCards,
  matchedCards: StudentWithCards["studentCards"]
) {
  if (
    lesson.danceType !== DanceType.BACHATA &&
    lesson.danceType !== DanceType.SALSA
  ) {
    return null;
  }

  if (studentNotQualified(lesson, student)) {
    return null;
  }

  const practiceCards = matchedCards.filter((studentCard) => studentCard.card.isPracticeCard);
  return getRecommendedStudentCard(practiceCards) ?? null;
}

function getRecommendedStudentCard(cards: StudentWithCards["studentCards"]) {
  if (cards.length === 0) {
    return null;
  }

  return [...cards].sort((a, b) => {
    if (a.remainingSessions !== b.remainingSessions) {
      return a.remainingSessions - b.remainingSessions;
    }

    if (a.expiredAt && b.expiredAt) {
      return new Date(a.expiredAt).getTime() - new Date(b.expiredAt).getTime();
    }

    if (a.expiredAt) {
      return -1;
    }

    if (b.expiredAt) {
      return 1;
    }

    return a.id - b.id;
  })[0];
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