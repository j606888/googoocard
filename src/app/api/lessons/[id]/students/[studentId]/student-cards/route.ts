import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom, findStudentInClassroom } from "@/lib/authz";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params;
  const { classroomId } = await decodeAuthToken();

  // Ran with no auth at all until 2026-08-23 — any student's usable cards were
  // readable given any lesson id.
  const scopedLesson = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scopedLesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: scopedLesson.id,
    },
    include: {
      cards: true,
    }
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  const student = await findStudentInClassroom(parseInt(studentId), classroomId);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const lessonCardIds = lesson.cards.map((card) => card.cardId);

  const studentCards = await prisma.studentCard.findMany({
    where: {
      studentId: student.id,
      expiredAt: null,
      remainingSessions: {
        gt: 0,
      },
    },
    include: {
      card: true,
      attendanceRecords: {
        include: {
          lessonPeriod: {
            include: {
              lesson: true,
            }
          },
          
        }
      },
    },
    orderBy: {
      createdAt: "desc",
    }
  });

  const validStudentCards = studentCards.filter((studentCard) =>
    lessonCardIds.includes(studentCard.cardId)
  );

  return NextResponse.json(validStudentCards);
}