import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id, periodId } = await params;

  const lessonPeriod = await prisma.lessonPeriod.findUnique({
    where: { id: parseInt(periodId), lessonId: parseInt(id) },
  });

  if (!lessonPeriod) {
    return NextResponse.json({ error: "Lesson period not found" }, { status: 404 });
  }

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { lessonPeriodId: parseInt(periodId) },
    include: {
      studentCard: true,
    }
  });

  await prisma.$transaction(async (tx) => {
    for (const attendanceRecord of attendanceRecords) {
      await tx.studentCard.update({
        where: { id: attendanceRecord.studentCardId },
        data: {
          remainingSessions: { increment: 1 },
        },
      });

      await tx.attendanceRecord.delete({
        where: { id: attendanceRecord.id },
      });
    }

    await tx.lessonPeriod.update({
      where: { id: parseInt(periodId) },
      data: {
        attendanceTakenAt: null,
      },
    });
  });

  await refreshLesson(parseInt(id));

  return NextResponse.json({ success: true });
}