import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id, periodId } = await params;

  await prisma.lessonPeriod.delete({
    where: { id: parseInt(periodId), lessonId: parseInt(id) },
  });

  await refreshLesson(parseInt(id));

  return NextResponse.json({ success: true });
}
