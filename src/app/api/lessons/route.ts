import { decodeAuthToken } from "@/lib/auth";
import { DraftLesson } from "@/store/slices/lessons";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const { classroomId } = await decodeAuthToken();
  const lessons = await prisma.lesson.findMany({
    where: {
      classroomId: classroomId,
    },
    include: {
      periods: true,
      students: {
        include: {
          student: true,
        },
      },
    },
  });

  const result = lessons.map((lesson) => ({
    ...lesson,
    students: lesson.students.map((student) => student.student)
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const draftLesson = await request.json() as DraftLesson;

  await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        name: draftLesson.lessonName,
        classroomId: classroomId!,
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

    await tx.lessonPeriod.createMany({
      data: draftLesson.periods.map((period) => ({
        lessonId: lesson.id,
        startTime: new Date(period.startTime),
        endTime: new Date(period.endTime),
      })),
    });

    const cards = await tx.card.findMany({
      where: {
        id: {
          in: draftLesson.cardIds,
        },
      },
    });

    for (const answer of draftLesson.answers) {
      await tx.lessonStudent.create({
        data: {
          lessonId: lesson.id,
          studentId: answer.studentId,
        },
      });
  
      if (answer.createNewCard) {
        const card = cards.find((card) => card.id === answer.selectedCardId);
        if (!card) throw new Error("Card not found");
        
        await tx.studentCard.create({
          data: {
            studentId: answer.studentId,
            cardId: card.id,
            basePrice: card.price,
            finalPrice: parseInt(answer.cardPrice),
            totalSessions: card.sessions,
            remainingSessions: parseInt(answer.cardSessions),
          },
        });
      }
    }
  });

  return NextResponse.json({ message: "Lesson created" });
}