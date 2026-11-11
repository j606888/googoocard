import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId, parseQuery } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { findTeacherInClassroom, requireLocationsInClassroom } from "@/lib/authz";
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

  const { archived, locationIds, ...fields } = await parseBody(request, updateTeacherSchema);
  if (archived && teacher.userId !== null) {
    throw new ApiError(409, "PERSON_HAS_ACCOUNT", "Remove the member from the team first");
  }
  const locations =
    locationIds === undefined
      ? undefined
      : await requireLocationsInClassroom(locationIds, classroomId);

  return prisma.teacher.update({
    where: { id },
    data: {
      ...fields,
      ...(locations ? { locations: { set: locations.map((id) => ({ id })) } } : {}),
      ...(archived === undefined
        ? {}
        : { archivedAt: archived ? (teacher.archivedAt ?? new Date()) : null }),
    },
    select: teacherPayloadSelect,
  });
});

// Only a teacher who never had a lesson (taught or assisted) can be deleted (a typo, a mistake);
// anyone else is archived, so old lessons keep their teacher.
export const DELETE = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  const id = parseId(params.id);
  const teacher = await findTeacherInClassroom(id, classroomId);
  if (!teacher) throw notFound("Teacher");
  if (teacher.userId !== null) {
    throw new ApiError(409, "PERSON_HAS_ACCOUNT", "Remove the member from the team first");
  }

  const [taught, assisted] = await Promise.all([
    prisma.lessonTeacher.count({ where: { teacherId: id } }),
    prisma.lessonAssistant.count({ where: { teacherId: id } }),
  ]);
  if (taught || assisted) {
    throw new ApiError(409, "TEACHER_HAS_LESSONS", "Teacher has lessons; archive instead");
  }

  return prisma.teacher.delete({ where: { id }, select: teacherPayloadSelect });
});
