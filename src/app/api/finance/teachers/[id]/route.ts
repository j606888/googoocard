import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { findTeacherInClassroom } from "@/lib/authz";
import { assertFinance } from "@/service/finance/access";
import { assertFinanceMember } from "@/service/finance/config";

const patchSchema = z.object({ payerUserId: z.number().int().positive().nullable() });

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const teacher = await findTeacherInClassroom(parseId(params.id), classroomId);
  if (!teacher) throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  const { payerUserId } = await parseBody(request, patchSchema);
  if (payerUserId !== null) await assertFinanceMember(payerUserId, classroomId);
  return prisma.teacher.update({
    where: { id: teacher.id },
    data: { payerUserId },
    select: { id: true, name: true, payerUserId: true },
  });
});
