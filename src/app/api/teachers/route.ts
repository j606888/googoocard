import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const teachers = await prisma.teacher.findMany({
    where: {
      classroomId,
    },
    include: {
      lessons: {
        include: {
          lesson: true,
        },
      },
    },
  });

  const result = teachers.map((teacher) => ({
    ...teacher,
    lessonCount: teacher.lessons.length,
    activeLessonCount: teacher.lessons.filter((lesson) => lesson.lesson.status === "inProgress").length,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const teacher = await prisma.teacher.create({
    data: { name, classroomId: classroomId! },
  });

  return NextResponse.json(teacher);
}
