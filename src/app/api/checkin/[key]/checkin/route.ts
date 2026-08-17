import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { selfCheckIn } from "@/domains/attendance/attendance.service";
import { getTodayLessons, resolveCheckinClassroom } from "@/service/checkin";

// Student self check-in from the wall-poster QR page. There is intentionally NO
// identity verification — the studio trusts students to only sign themselves in,
// and a 助教 reviews the roster before finalizing the period. What IS enforced is
// the classroom boundary and the date: a key only ever touches its own
// classroom's students and lessons, and only today's periods.
//
// Records are written by `selfCheckIn` exactly like the LIFF flow
// (source = STUDENT, card deducted, `attendanceTakenAt` left unset, idempotent
// per (student, period)), so the teacher-side check screen needs no changes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  const classroom = await resolveCheckinClassroom(key);
  if (!classroom) {
    return NextResponse.json({ error: "invalid_key" }, { status: 404 });
  }

  const { studentId, lessonId, periodIds } = await request.json();

  if (!Array.isArray(periodIds) || periodIds.length === 0) {
    return NextResponse.json({ error: "missing_periodIds" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: Number(studentId) },
  });
  if (!student || student.classroomId !== classroom.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: Number(lessonId) } });
  if (!lesson || lesson.classroomId !== classroom.id) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Only today's periods are signable. `selfCheckIn` already restricts the ids
  // to the lesson; this adds the date boundary so a leaked key can't be used to
  // back-fill or pre-sign another day.
  const { today } = await getTodayLessons(classroom.id);
  const todayPeriodIds = new Set(
    today.flatMap((l) => l.periods.map((p) => p.periodId))
  );
  const requestedIds = periodIds.map(Number);
  if (requestedIds.some((id) => !todayPeriodIds.has(id))) {
    return NextResponse.json({ error: "period_not_today" }, { status: 400 });
  }

  const results = await selfCheckIn({
    studentId: student.id,
    lessonId: lesson.id,
    lessonPeriodIds: requestedIds,
  });

  return NextResponse.json({ results });
}
