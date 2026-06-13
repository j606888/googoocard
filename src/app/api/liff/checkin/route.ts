import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import { selfCheckIn } from "@/domains/attendance/attendance.service";

// Student self check-in from the LIFF「上課簽到」page. Auth is a LIFF ID token;
// ownership enforced via resolveOwnedStudent. Records attendance for the chosen
// period(s) of a lesson and deducts a card per period (source = STUDENT, does NOT
// finalize the period — the teacher still reviews). Idempotent per period.
export async function POST(request: Request) {
  const { studentId, lessonId, periodIds } = await request.json();

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;

  if (!Array.isArray(periodIds) || periodIds.length === 0) {
    return NextResponse.json({ error: "missing_periodIds" }, { status: 400 });
  }

  // The lesson must belong to this student's classroom.
  const lesson = await prisma.lesson.findUnique({ where: { id: Number(lessonId) } });
  if (!lesson || lesson.classroomId !== student.classroomId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const results = await selfCheckIn({
    studentId: student.id,
    lessonId: lesson.id,
    lessonPeriodIds: periodIds.map(Number),
  });

  return NextResponse.json({ results });
}
