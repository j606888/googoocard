import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const teachers = await prisma.teacher.findMany();
  return NextResponse.json(teachers);
}

export async function POST(request: Request) {
  const { name, classroomId } = await request.json();

  const teacher = await prisma.teacher.create({
    data: { name, classroomId },
  });

  return NextResponse.json(teacher);
}