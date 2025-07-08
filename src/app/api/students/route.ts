import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

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
          remainingSessions: {
            gt: 0,
          },
        },
        include: {
          card: true,
        },
      },
    },
  });

  const results = students.map((student) => ({
    ...student,
    studentCards: student.studentCards.map((studentCard) => ({
      ...studentCard,
      card: studentCard.card,
    })),
  }));

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const { name, avatarUrl } = await request.json();
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
    data: { name, avatarUrl, classroomId: classroomId!, randomKey: nanoid(8) },
  });

  return NextResponse.json(student);
}
