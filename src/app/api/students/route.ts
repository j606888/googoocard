import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { createStudent } from "@/service/student";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const needsRenewalParam = searchParams.get("needsRenewal");
  const filterNeedsRenewal = needsRenewalParam === "true";
  const sort = searchParams.get("sort") === "number" ? "number" : "name";

  const students = await prisma.student.findMany({
    where: {
      classroomId,
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filterNeedsRenewal
        ? {
            studentTags: {
              some: { tag: { name: "Needs Renewal", classroomId } },
            },
          }
        : {}),
    },
    orderBy: sort === "number" ? { number: "asc" } : { name: "asc" },
    include: {
      studentCards: {
        where: {
          expiredAt: null,
        },
        include: {
          card: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      studentTags: {
        include: { tag: true },
        orderBy: { createdAt: "asc" },
      },
      danceQualifications: true,
      lessons: {
        include: {
          lesson: { select: { id: true, status: true } },
        },
      },
    },
  });

  const results = students.map((student) => {
    const activeStudentCards = student.studentCards.filter(
      (studentCard) => studentCard.remainingSessions > 0
    );

    const isInActiveLesson = student.lessons.some(
      (ls) => ls.lesson.status === "inProgress"
    );
    const activeLessonIds = student.lessons
      .filter((ls) => ls.lesson.status === "inProgress")
      .map((ls) => ls.lesson.id);

    return {
      ...student,
      tags: student.studentTags.map((st) => ({ id: st.tag.id, name: st.tag.name })),
      danceQualifications: student.danceQualifications.map((q) => q.danceType),
      isInActiveLesson,
      activeLessonIds,
      lessons: undefined,
      studentTags: undefined,
      studentCards: activeStudentCards.map((studentCard) => ({
        ...studentCard,
        card: studentCard.card,
      })),
    };
  });

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const { name, avatarUrl, note } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const existingStudent = await prisma.student.findFirst({
    where: {
      name,
      classroomId,
    },
  });

  if (existingStudent) {
    return NextResponse.json(
      { error: "Student already exists" },
      { status: 400 }
    );
  }

  const student = await createStudent(classroomId!, { name, avatarUrl, note });

  return NextResponse.json(student);
}
