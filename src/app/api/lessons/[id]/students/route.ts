import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";
import { toStudentPayload } from "@/service/studentDetail";

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
  const { classroomId } = await decodeAuthToken();

  // Ran with no auth at all until 2026-08-23 — any lesson's roster and
  // per-period attendance was readable by incrementing the lesson id.
  const scoped = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scoped) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: scoped.id },
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

    // Whitelist, not `...student` — the roster only needs identity, and the
    // row carries `lineBindKey` / `randomKey`. See toStudentPayload.
    return {
      ...toStudentPayload(student),
      attendances,
    };
  });

  return NextResponse.json(students);
}
