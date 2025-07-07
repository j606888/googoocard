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
      let attendanceStatus: "not_started" | "attended" | "absent" = ATTENDANCE_STATUS.NOT_STARTED

      if (period.attendanceTakenAt) {
        const record = period.attendanceRecords.find(
          (record) => record.studentId === student.id
        );
        attendanceStatus = record ? ATTENDANCE_STATUS.ATTENDED : ATTENDANCE_STATUS.ABSENT;
      }

      return {
        startTime: period.startTime,
        attendanceStatus,
      }
    });

    return {
      ...student,
      attendances,
    };
  });

  return NextResponse.json(students);
}
