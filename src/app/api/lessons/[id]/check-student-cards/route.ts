import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const { studentIds } = await request.json();

  if (!Array.isArray(studentIds)) {
    return NextResponse.json({ error: "studentIds must be an array" }, { status: 400 });
  }

  // Ran with no auth at all until 2026-08-23 — an arbitrary studentIds array
  // could be used to probe whether any student held a usable card.
  const scoped = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scoped) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: scoped.id },
    include: {
      cards: true,
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const validCardIds = lesson.cards.map((card) => card.cardId);
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      classroomId,
    },
    include: {
      studentCards: {
        where: {
          cardId: { in: validCardIds },
          remainingSessions: {
            gt: 0,
          }
        }
      }
    }
  });

  const result = students.map((student) => ({
    studentId: student.id,
    validCards: student.studentCards.map((card) => card.cardId),
  }));

  const invalidStudentIds = result.filter(s => s.validCards.length === 0).map(s => s.studentId);

  return NextResponse.json({
    invalidStudentIds,
  });
}