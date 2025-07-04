import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studentIds } = await request.json();

  const lesson = await prisma.lesson.findUnique({
    where: { id: parseInt(id) },
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