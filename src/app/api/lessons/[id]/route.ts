import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DraftLesson } from "@/store/slices/lessons";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: parseInt(id) },
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
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const result = {
    ...lesson,
    students: lesson.students.map((student) => student.student),
    teachers: lesson.teachers.map((teacher) => teacher.teacher),
    cards: lesson.cards.map((card) => card.card),
  };

  return NextResponse.json(result);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draftLesson = await request.json() as DraftLesson;
  const lesson = await prisma.lesson.update({
    where: { id: parseInt(id) },
    data: {
      name: draftLesson.lessonName,
      danceType: draftLesson.danceType,
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