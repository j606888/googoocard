import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { findTeacherInClassroom } from "@/lib/authz";
import { assertCanSettle } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";

const patchSchema = z.object({ payerUserId: z.number().int().positive().nullable() });

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const teacher = await findTeacherInClassroom(parseId(params.id), classroomId);
  if (!teacher) throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  const { payerUserId } = await parseBody(request, patchSchema);
  if (payerUserId !== null) await assertCustodian(payerUserId, classroomId);
  return prisma.teacher.update({
    where: { id: teacher.id },
    data: { payerUserId },
    select: { id: true, name: true, payerUserId: true },
  });
});
