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

  const refundedCardIds = attendanceRecords
    .map((record) => record.studentCardId)
    .filter((cardId): cardId is number => cardId !== null);

  await prisma.$transaction(async (tx) => {
    for (const attendanceRecord of attendanceRecords) {
      if (attendanceRecord.studentCardId) {
        await tx.studentCard.update({
          where: { id: attendanceRecord.studentCardId },
          data: {
            remainingSessions: { increment: 1 },
          },
        });
      }

      await tx.attendanceRecord.delete({
        where: { id: attendanceRecord.id },
      });
    }

    // Clean up audit events whose source we just removed: the "簽到" events for
    // the deleted attendance records, and "課卡使用完畢" events for refunded cards.
    await tx.event.deleteMany({
      where: {
        resourceType: "attendanceRecord",
        resourceId: { in: attendanceRecords.map((r) => r.id) },
      },
    });
    if (refundedCardIds.length > 0) {
      await tx.event.deleteMany({
        where: {
          resourceType: "studentCard",
          title: "課卡使用完畢",
          resourceId: { in: refundedCardIds },
        },
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