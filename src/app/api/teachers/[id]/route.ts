import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId, parseQuery } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { findTeacherInClassroom } from "@/lib/authz";
import { teacherMonthQuerySchema, updateTeacherSchema } from "@/lib/schemas";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { teacherPayloadSelect } from "@/lib/teachers";
import { getTeacherDetail } from "@/service/teachers";

export const GET = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  const id = parseId(params.id);
  const { month } = parseQuery(request, teacherMonthQuerySchema);
  const detail = await getTeacherDetail(id, classroomId, month ?? toTaipeiMonthKey(new Date()));
  if (!detail) throw notFound("Teacher");
  return detail;
});

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  const id = parseId(params.id);
  const teacher = await findTeacherInClassroom(id, classroomId);
  if (!teacher) throw notFound("Teacher");

  const { archived, ...fields } = await parseBody(request, updateTeacherSchema);

  return prisma.teacher.update({
    where: { id },
    data: {
      ...fields,
      ...(archived === undefined
        ? {}
        : { archivedAt: archived ? (teacher.archivedAt ?? new Date()) : null }),
    },
    select: teacherPayloadSelect,
  });
});

// Only a teacher who never had a lesson — nor helped in one — can be deleted
// (a typo, a mistake); anyone else is archived, so old lessons keep their teacher.
export const DELETE = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  const id = parseId(params.id);
  if (!(await findTeacherInClassroom(id, classroomId))) throw notFound("Teacher");

  const [taught, assisted] = await Promise.all([
    prisma.lessonTeacher.count({ where: { teacherId: id } }),
    prisma.lessonPeriodAssistant.count({ where: { teacherId: id } }),
  ]);
  if (taught || assisted) {
    throw new ApiError(409, "TEACHER_HAS_LESSONS", "Teacher has lessons; archive instead");
  }

  return prisma.teacher.delete({ where: { id }, select: teacherPayloadSelect });
});
