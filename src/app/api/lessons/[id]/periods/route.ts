import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";
import { refreshLesson } from "@/service/lesson";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!(await findLessonInClassroom(parseInt(id), classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const { startTime, endTime } = await request.json();

  await prisma.lessonPeriod.create({
    data: {
      lessonId: parseInt(id),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  });

  await refreshLesson(parseInt(id));

  return NextResponse.json({ success: true });
}