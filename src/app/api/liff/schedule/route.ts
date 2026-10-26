import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken } from "@/lib/liffAuth";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { lessonLevelLabel } from "@/lib/danceLevels";
import { parseTaipeiMonthRange, toTaipeiMonthKey } from "@/lib/taipei-date";
import { resolveLiffClassroom } from "@/service/liffClassroom";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// LIFF「課表」月曆：一個月（台北）的所有時段。學生和還沒綁定的人都能看——教室怎麼選見
// resolveLiffClassroom。帶 studentId 時多回 myLessonIds（他上過或報名的課），給「我的課」篩選。
// 手動結束的課（endedAt）只列結束前的時段。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const month = monthParam && MONTH.test(monthParam) ? monthParam : toTaipeiMonthKey(new Date());

  const resolved = await resolveLiffClassroom(bearerToken(request), {
    studentId: Number(url.searchParams.get("studentId")) || undefined,
    classroomId: Number(url.searchParams.get("classroomId")) || undefined,
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, classrooms: resolved.classrooms }, { status: resolved.status });
  }
  const { classroom, student, listed } = resolved;

  const { start, end } = parseTaipeiMonthRange(month);
  const [periods, locations, myLessons] = await Promise.all([
    prisma.lessonPeriod.findMany({
      where: { startTime: { gte: start, lt: end }, lesson: { classroomId: classroom.id } },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        lesson: {
          select: {
            id: true,
            name: true,
            level: true,
            endedAt: true,
            danceStyle: { select: danceStyleSummarySelect },
            location: { select: { id: true, name: true } },
            teachers: { select: { teacher: { select: { name: true } } }, orderBy: { id: "asc" } },
          },
        },
      },
    }),
    prisma.location.findMany({
      where: { classroomId: classroom.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    student
      ? prisma.lessonStudent.findMany({ where: { studentId: student.id }, select: { lessonId: true } })
      : Promise.resolve([]),
  ]);

  const visible = periods.filter((p) => !p.lesson.endedAt || p.startTime < p.lesson.endedAt);
  const styles = new Map(visible.map((p) => [p.lesson.danceStyle.id, p.lesson.danceStyle]));

  return NextResponse.json({
    classroom,
    month,
    classrooms: listed.length > 1 ? listed : [],
    locations,
    danceStyles: [...styles.values()],
    myLessonIds: [...new Set(myLessons.map((l) => l.lessonId))],
    periods: visible.map((p) => ({
      id: p.id,
      lessonId: p.lesson.id,
      startTime: p.startTime,
      endTime: p.endTime,
      lessonName: p.lesson.name,
      danceStyleId: p.lesson.danceStyle.id,
      levelLabel: lessonLevelLabel(p.lesson.danceStyle, p.lesson.level),
      teacherNames: p.lesson.teachers.map((t) => t.teacher.name),
      location: p.lesson.location,
    })),
  });
}
