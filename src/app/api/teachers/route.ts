import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { createTeacherSchema } from "@/lib/schemas";
import { firstFreeTeacherColor, teacherPayloadSelect } from "@/lib/teachers";

// The plain list, archived included — the lesson teacher picker filters
// archived ones itself (an old lesson still shows its archived teacher).
// The teachers page reads /api/teachers/overview instead.
export const GET = apiRoute(async ({ classroomId }) => {
  const teachers = await prisma.teacher.findMany({
    where: { classroomId },
    select: {
      ...teacherPayloadSelect,
      // Who this teacher is on the team — the invite / role pickers skip linked ones.
      userId: true,
      _count: { select: { lessons: true } },
    },
    orderBy: { id: "asc" },
  });

  const active = await prisma.lessonTeacher.groupBy({
    by: ["teacherId"],
    where: { teacher: { classroomId }, lesson: { status: "inProgress" } },
    _count: { _all: true },
  });
  const activeById = new Map(active.map((row) => [row.teacherId, row._count._all]));

  return teachers.map(({ _count, ...teacher }) => ({
    ...teacher,
    lessonCount: _count.lessons,
    activeLessonCount: activeById.get(teacher.id) ?? 0,
  }));
});

export const POST = apiRoute(async ({ request, classroomId }) => {
  const { name, color, note, isAssistant } = await parseBody(request, createTeacherSchema);

  const taken = color
    ? []
    : await prisma.teacher.findMany({
        where: { classroomId, archivedAt: null },
        select: { color: true },
      });

  return prisma.teacher.create({
    data: {
      classroomId,
      name,
      color: color ?? firstFreeTeacherColor(taken),
      note: note ?? null,
      isAssistant: isAssistant ?? false,
    },
    select: teacherPayloadSelect,
  });
});
