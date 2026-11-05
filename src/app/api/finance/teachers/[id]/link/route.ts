import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { findMembership, findTeacherInClassroom } from "@/lib/authz";
import { canLinkTeacher } from "@/lib/roles";
import { assertCanSettle } from "@/service/finance/access";
import { linkTeacher } from "@/service/team";

const schema = z.object({ userId: z.number().int().positive() });

// 開帳清單付款人那一步「這位老師是 X 本人嗎？連結帳號」：把沒連帳號的老師連到那位成員。
// 只連還沒連帳號的老師、還沒連別的老師的成員（不搬動既有連結；要換請到團隊頁）。小幫手不能連老師。
export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const teacher = await findTeacherInClassroom(parseId(params.id), classroomId);
  if (!teacher) throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  const body = await parseBody(request, schema);
  const membership = await findMembership(body.userId, classroomId);
  if (!membership) throw badRequest("NOT_A_MEMBER", "User is not a member of this classroom");
  if (!canLinkTeacher(membership.role)) {
    throw badRequest("ASSISTANT_CANNOT_LINK_TEACHER", "A 小幫手 is not linked to a teacher");
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.teacher.findFirst({
      where: { classroomId, userId: body.userId },
      select: { id: true },
    });
    if (existing && existing.id !== teacher.id) {
      throw new ApiError(409, "MEMBER_ALREADY_LINKED", "This member is already linked to another teacher");
    }
    await linkTeacher(tx, classroomId, body.userId, teacher.id);
    return { id: teacher.id, userId: body.userId };
  });
});
