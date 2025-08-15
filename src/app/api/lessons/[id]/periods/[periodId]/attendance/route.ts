import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";
import { CardStatus } from "@prisma/client";

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
          student: true,
          studentCard: {
            include: {
              card: true,
              student: true,
            },
          }
        },
      },
    },
  });

  const attendanceRecords = lessonPeriod?.attendanceRecords.map((record) => {
    const studentCard = record.studentCard;
    let studentCardData = {}

    if (studentCard) {
      studentCardData = {
        cardId: studentCard.cardId,
        cardName: studentCard.card.name,
        remainingSessions: studentCard.remainingSessions,
        income: studentCard.finalPrice / studentCard.totalSessions,
      }
    }
    return {
      studentId: record.studentId,
      studentAvatarUrl: record.student.avatarUrl,
      studentName: record.student.name,
      cardStatus: record.cardStatus,
      ...studentCardData,
    }
  });

  return NextResponse.json(attendanceRecords);
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
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const student of students) {
      let studentCard = null;
      let cardStatus: CardStatus;
      if (student.studentCards.length === 0) {
        cardStatus = CardStatus.MISSING_CARD;
      } else if (student.studentCards.length === 1) {
        studentCard = student.studentCards[0];
        cardStatus = CardStatus.SUCCESS;
      } else {
        cardStatus = CardStatus.MULTIPLE_CARDS;
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

      await tx.attendanceRecord.create({
        data: {
          lessonPeriodId: lessonPeriod.id,
          studentId: student.id,
          studentCardId: studentCard?.id,
          cardStatus,
        },
      });

      if (studentCard) {
        await tx.studentCard.update({
          where: { id: studentCard.id },
          data: {
            remainingSessions: {
              decrement: 1,
            },
          },
        });
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
