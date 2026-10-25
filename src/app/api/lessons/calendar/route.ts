import { decodeAuthToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";

// Returns every LessonPeriod (session) whose startTime falls in [from, to) for
// the current classroom, flattened for the calendar month grid. Unlike
// GET /api/lessons (which collapses periods into a per-lesson summary), this
// exposes each session with its lesson info and attendee count.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { classroomId } = await decodeAuthToken();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing `from` or `to` range" },
      { status: 400 }
    );
  }

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      startTime: { gte: new Date(from), lt: new Date(to) },
      lesson: { classroomId },
    },
    include: {
      lesson: {
        select: {
          id: true,
          name: true,
          danceStyleId: true,
          danceStyle: { select: danceStyleSummarySelect },
          location: { select: locationSummarySelect },
          status: true,
          teachers: {
            select: { teacher: { select: { name: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
      _count: { select: { attendanceRecords: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const result = periods.map((period) => ({
    periodId: period.id,
    lessonId: period.lesson.id,
    lessonName: period.lesson.name,
    danceStyleId: period.lesson.danceStyleId,
    danceStyle: period.lesson.danceStyle,
    lessonStatus: period.lesson.status,
    startTime: period.startTime,
    endTime: period.endTime,
    attendanceTaken: Boolean(period.attendanceTakenAt),
    attendeeCount: period._count.attendanceRecords,
    teacherNames: period.lesson.teachers.map((t) => t.teacher.name),
    location: period.lesson.location,
  }));

  return NextResponse.json(result);
}
