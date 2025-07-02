import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
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