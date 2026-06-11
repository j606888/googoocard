import { decodeAuthToken } from "@/lib/auth";
import { DraftLesson } from "@/store/slices/lessons";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";
import { cardMatchesLesson } from "@/domains/qualification";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { classroomId } = await decodeAuthToken();
  const tab = searchParams.get("tab") ?? "inProgress";
  const sort = searchParams.get("sort") ?? "name";

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderBy = sort === "name" ? { name: "asc" as const } : { endAt: "desc" as const };

  const lessons = await prisma.lesson.findMany({
    where: {
      classroomId: classroomId,
      status: tab,
    },
    orderBy,
    include: {
      periods: true,
      students: {
        include: {
          student: true,
        },
      },
      teachers: {
        include: {
          teacher: true,
        },
      },
      cards: {
        include: {
          card: true,
        },
      },
    },
  });

  const tabsCount = {
    inProgress: await prisma.lesson.count({
      where: {
        classroomId: classroomId,
        status: "inProgress",
      },
    }),
    finished: await prisma.lesson.count({
      where: {
        classroomId: classroomId,
        status: "finished",
      },
    }),
  }

  const result = lessons.map((lesson) => ({
    ...lesson,
    students: lesson.students.map((student) => student.student),
    teachers: lesson.teachers.map((teacher) => teacher.teacher),
    cards: lesson.cards.map((card) => card.card),
  }));

  return NextResponse.json({ lessons: result, tabsCount });
}

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const draftLesson = await request.json() as DraftLesson;

  const cards = await prisma.card.findMany({
    where: { id: { in: draftLesson.cardIds } },
  });
  const mismatchedCards = cards.filter(
    (card) => !cardMatchesLesson(card, draftLesson.danceType)
  );
  if (mismatchedCards.length > 0) {
    return NextResponse.json(
      {
        error: "PRACTICE_CARD_DANCE_TYPE_MISMATCH",
        cardNames: mismatchedCards.map((card) => card.name),
      },
      { status: 400 }
    );
  }

  const lesson = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        name: draftLesson.lessonName,
        classroomId: classroomId!,
        status: "inProgress",
        danceType: draftLesson.danceType,
      },
    });

    await tx.lessonTeacher.createMany({
      data: draftLesson.teacherIds.map((teacherId) => ({
        teacherId,
        lessonId: lesson.id,
      })),
    });

    await tx.lessonCard.createMany({
      data: draftLesson.cardIds.map((cardId) => ({
        cardId,
        lessonId: lesson.id,
      })),
    });

    if (draftLesson.periods) {
    await tx.lessonPeriod.createMany({
      data: draftLesson.periods.map((period) => ({
        lessonId: lesson.id,
          startTime: new Date(period.startTime),
          endTime: new Date(period.endTime),
        })),
      });
    }

    return lesson
  });

  await refreshLesson(lesson.id);

  return NextResponse.json({ message: "Lesson created" });
}