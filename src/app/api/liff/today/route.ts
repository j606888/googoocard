import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import { toTaipeiDateKey, parseTaipeiDateRange } from "@/lib/taipei-date";

// Data source for the LIFF「上課簽到」page. Auth is a LIFF ID token; the student
// is resolved + ownership-checked via resolveOwnedStudent. Returns today's
// (Taipei) lessons in the student's classroom with each period flagged for
// whether this student already checked in — walk-in style, not limited to
// lessons they're enrolled in. When there's no class today, returns the next
// upcoming lesson so the page can show「下次上課」.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = Number(url.searchParams.get("studentId"));

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;

  const now = new Date();
  const todayKey = toTaipeiDateKey(now);
  const { start, end } = parseTaipeiDateRange(todayKey);

  const lessons = await prisma.lesson.findMany({
    where: {
      classroomId: student.classroomId,
      periods: { some: { startTime: { gte: start, lt: end } } },
    },
    include: {
      periods: {
        where: { startTime: { gte: start, lt: end } },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const periodIds = lessons.flatMap((l) => l.periods.map((p) => p.id));
  const checkedRecords = periodIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { studentId: student.id, lessonPeriodId: { in: periodIds } },
        select: { lessonPeriodId: true },
      })
    : [];
  const checkedIds = new Set(checkedRecords.map((r) => r.lessonPeriodId));

  const today = lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonName: lesson.name,
    danceType: lesson.danceType,
    periods: lesson.periods.map((period) => ({
      periodId: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      alreadyChecked: checkedIds.has(period.id),
    })),
  }));

  let nextLesson: { lessonName: string; startTime: Date } | null = null;
  if (today.length === 0) {
    const next = await prisma.lessonPeriod.findFirst({
      where: { lesson: { classroomId: student.classroomId }, startTime: { gt: now } },
      orderBy: { startTime: "asc" },
      include: { lesson: { select: { name: true } } },
    });
    if (next) {
      nextLesson = { lessonName: next.lesson.name, startTime: next.startTime };
    }
  }

  return NextResponse.json({ date: todayKey, today, nextLesson });
}
