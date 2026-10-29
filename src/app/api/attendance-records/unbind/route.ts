import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { UNRESOLVED_ATTENDANCE } from "@/service/dropIn";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const unbindRecords = await prisma.attendanceRecord.findMany({
    where: {
      student: {
        classroomId,
      },
      ...UNRESOLVED_ATTENDANCE,
    },
    include: {
      student: true,
      lessonPeriod: {
        include: {
          lesson: true,
        },
      }
    },
    orderBy: {
      lessonPeriod: {
        startTime: "asc",
      },
    }
  });

  const formattedRecords = unbindRecords.map((record) => {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student.name,
      studentAvatarUrl: record.student.avatarUrl,
      lessonName: record.lessonPeriod.lesson.name,
      lessonId: record.lessonPeriod.lessonId,
      lessonPeriodId: record.lessonPeriodId,
      lessonPeriodStartTime: record.lessonPeriod.startTime,
    };
  });

  return NextResponse.json(formattedRecords);
}