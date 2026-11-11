import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertAdmin } from "@/lib/authz";
import { createInviteSchema } from "@/lib/schemas";
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

/**
 * 管理員 only: an invite link that hands out `role`. With `teacherId` it's for
 * that one person on the roster (any role) — single-use, and the joiner's account
 * gets linked to that person. Without it the joiner gets a new person record.
 */
export const POST = apiRoute(async ({ request, classroomId, role: callerRole }) => {
  assertAdmin(callerRole);
  const { maxUses, role, teacherId } = await parseBody(request, createInviteSchema);

  const linkTo = teacherId ?? null;
  if (linkTo) {
    await findLinkableTeacher(prisma, classroomId, linkTo, null);
  }

  return prisma.inviteToken.create({
    // A person link is one person — a second joiner couldn't take the same row.
    data: { classroomId, maxUses: linkTo ? 1 : maxUses, uses: 0, role, teacherId: linkTo, token: nanoid(8) },
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
