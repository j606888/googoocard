import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const needsRenewalParam = searchParams.get("needsRenewal");
  const filterNeedsRenewal = needsRenewalParam === "true";

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
    },
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
    },
  });

  const results = students
    .map((student) => {
      const renewableCards = student.studentCards.filter(
        (studentCard) => studentCard.totalSessions > 1
      );
      const activeStudentCards = student.studentCards.filter(
        (studentCard) => studentCard.remainingSessions > 0
      );

      const latestCardByType = new Map<number, (typeof renewableCards)[number]>();
      for (const studentCard of renewableCards) {
        if (!latestCardByType.has(studentCard.cardId)) {
          // studentCards already sorted by createdAt desc, first one is latest
          latestCardByType.set(studentCard.cardId, studentCard);
        }
      }

      const needsRenewal = [...latestCardByType.values()].some(
        (studentCard) => studentCard.remainingSessions === 0
      );

      return {
        ...student,
        needsRenewal,
        studentCards: activeStudentCards.map((studentCard) => ({
          ...studentCard,
          card: studentCard.card,
        })),
      };
    })
    .filter((student) => (filterNeedsRenewal ? student.needsRenewal : true));

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

  const student = await prisma.student.create({
    data: { name, avatarUrl, note, classroomId: classroomId!, randomKey: nanoid(8) },
  });

  return NextResponse.json(student);
}
