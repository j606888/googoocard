import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom, findLessonGroupInClassroom } from "@/lib/authz";
import { DraftLesson } from "@/store/slices/lessons";
import { toStudentPayload } from "@/service/studentDetail";
import { cardMatchesLesson } from "@/domains/qualification";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  // PUT/DELETE in this file were scoped in commit 00cf407; GET was left
  // unauthenticated, exposing any lesson's roster, teachers and cards.
  const scoped = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scoped) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: scoped.id },
    include: {
      periods: {
        orderBy: {
          startTime: "asc",
        },
      },
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
      group: {
        select: { id: true, name: true },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const result = {
    ...lesson,
    // Whitelist — the raw Student row carries `lineBindKey`. See toStudentPayload.
    students: lesson.students.map((student) => toStudentPayload(student.student)),
    teachers: lesson.teachers.map((teacher) => teacher.teacher),
    cards: lesson.cards.map((card) => card.card),
  };

  return NextResponse.json(result);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!(await findLessonInClassroom(parseInt(id), classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  const draftLesson = await request.json() as DraftLesson;

  if (
    draftLesson.groupId != null &&
    !(await findLessonGroupInClassroom(draftLesson.groupId, classroomId))
  ) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

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

  const lesson = await prisma.lesson.update({
    where: { id: parseInt(id) },
    data: {
      name: draftLesson.lessonName,
      danceType: draftLesson.danceType,
      groupId: draftLesson.groupId ?? null,
    },
  });

  await prisma.lessonTeacher.deleteMany({
    where: { lessonId: parseInt(id) },
  });
  await prisma.lessonTeacher.createMany({
    data: draftLesson.teacherIds.map((teacherId) => ({ teacherId, lessonId: parseInt(id) })),
  });

  await prisma.lessonCard.deleteMany({
    where: { lessonId: parseInt(id) },
  });
  await prisma.lessonCard.createMany({
    data: draftLesson.cardIds.map((cardId) => ({ cardId, lessonId: parseInt(id) })),
  });
  return NextResponse.json(lesson);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const lessonId = parseInt(id);
  if (!(await findLessonInClassroom(lessonId, classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  await prisma.lessonTeacher.deleteMany({ where: { lessonId } });
  await prisma.lessonCard.deleteMany({ where: { lessonId } });
  await prisma.lessonStudent.deleteMany({ where: { lessonId } });
  await prisma.lesson.delete({ where: { id: lessonId } });

  return NextResponse.json({});
}