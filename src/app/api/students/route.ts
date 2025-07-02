import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const students = await prisma.student.findMany({
    where: {
      classroomId,
    },
  });
  return NextResponse.json(students);
}

export async function POST(request: Request) {
  const { name, avatarUrl } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const student = await prisma.student.create({
    data: { name, avatarUrl, classroomId: classroomId! },
  });

  return NextResponse.json(student);
}
