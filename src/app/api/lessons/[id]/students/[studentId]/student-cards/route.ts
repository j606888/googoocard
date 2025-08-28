import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: {
      id: parseInt(id),
    },
    include: {
      cards: true,
    }
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  const student = await prisma.student.findUnique({
    where: {
      id: parseInt(studentId),
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const lessonCardIds = lesson.cards.map((card) => card.cardId);

  const studentCards = await prisma.studentCard.findMany({
    where: {
      studentId: parseInt(studentId),
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