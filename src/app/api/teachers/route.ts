import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const teachers = await prisma.teacher.findMany({
    where: {
      classroomId,
    },
  });
  return NextResponse.json(teachers);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const { classroomId } = await decodeAuthToken();
  console.log({ classroomId });

  const teacher = await prisma.teacher.create({
    data: { name, classroomId: classroomId! },
  });

  return NextResponse.json(teacher);
}
