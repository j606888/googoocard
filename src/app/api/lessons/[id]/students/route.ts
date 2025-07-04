import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ATTENDANCE_STATUS = {
  NOT_STARTED: "not_started",
  ATTENDED: "attended",
  ABSENT: "absent",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id: parseInt(id) },
    include: {
      students: {
        include: {
          student: true,
        },
      },
      periods: {
        orderBy: {
          startTime: "asc",
        },
        include: {
          attendanceRecords: true,
        },
      },
    },
  });

  const students = lesson?.students.map((lessonStudent) => {
    const student = lessonStudent.student;
    const attendances = lesson.periods.map((period) => {
      if (!period.attendanceTakenAt) return ATTENDANCE_STATUS.NOT_STARTED;

      const record = period.attendanceRecords.find(
        (record) => record.studentId === student.id
      );
      return record ? ATTENDANCE_STATUS.ATTENDED : ATTENDANCE_STATUS.ABSENT;
    });

    return {
      ...student,
      attendances,
    };
  });

  return NextResponse.json(students);
}
