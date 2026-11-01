import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { assertAdmin } from "@/lib/authz";
import { createInviteSchema } from "@/lib/schemas";
import { canLinkTeacher } from "@/lib/roles";
import { findLinkableTeacher } from "@/service/team";
import { nanoid } from "nanoid";

const inviteSelect = {
  id: true,
  token: true,
  maxUses: true,
  uses: true,
  role: true,
  classroomId: true,
  teacher: { select: { id: true, name: true, color: true } },
} as const;

/** 管理員 only: an invite link that hands out `role` (and, for a teacher, a Teacher row). */
export const POST = apiRoute(async ({ request, classroomId, role: callerRole }) => {
  assertAdmin(callerRole);
  const { maxUses, role, teacherId } = await parseBody(request, createInviteSchema);

  if (role === "teacher" && !teacherId) {
    throw badRequest("TEACHER_REQUIRED", "A teacher invite needs the teacher it links to");
  }
  const linkTo = teacherId && canLinkTeacher(role) ? teacherId : null;
  if (linkTo) {
    await findLinkableTeacher(prisma, classroomId, linkTo, null);
  }

  return prisma.inviteToken.create({
    // A teacher link is one person — a second joiner couldn't take the same Teacher row.
    data: { classroomId, maxUses: role === "teacher" ? 1 : maxUses, uses: 0, role, teacherId: linkTo, token: nanoid(8) },
    select: inviteSelect,
  });
});

export const GET = apiRoute(async ({ classroomId }) => {
  return prisma.inviteToken.findMany({
    where: { classroomId },
    orderBy: { id: "asc" },
    select: inviteSelect,
  });
});
