import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";
import { refreshLesson } from "@/service/lesson";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id, periodId } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!(await findLessonInClassroom(parseInt(id), classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  await prisma.lessonPeriod.delete({
    where: { id: parseInt(periodId), lessonId: parseInt(id) },
  });

  await refreshLesson(parseInt(id));

  return NextResponse.json({ success: true });
}
