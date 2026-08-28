import prisma from "@/lib/prisma";
import { createAuthSession } from "@/lib/auth";
import { sessionRoute } from "@/lib/apiRoute";
import { ApiError, badRequest } from "@/lib/apiError";

// `[id]` is the token string here, not a numeric id.
type Params = { id: string };

export const POST = sessionRoute<Params>(async ({ params, userId }) => {
  const token = params.id;

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
    include: { classroom: { select: { id: true, deletedAt: true } } },
  });

  // Same 404 for a token that never existed and one whose classroom has been
  // archived — a stale invite link shouldn't confirm the classroom ever existed.
  if (!inviteToken || inviteToken.classroom.deletedAt) {
    throw new ApiError(404, "INVITE_TOKEN_NOT_FOUND", "Invite token not found");
  }

  // Was keyed off the JWT's current classroom, so re-using a link for a
  // classroom you're already in — but not currently switched to — hit the
  // `@@unique([userId, classroomId])` constraint and answered 500.
  const existing = await prisma.membership.findFirst({
    where: { userId, classroomId: inviteToken.classroomId },
  });
  if (existing) {
    throw badRequest("ALREADY_A_MEMBER", "You are already a member of this classroom");
  }

  if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
    throw badRequest(
      "INVITE_TOKEN_EXHAUSTED",
      "Invite token has reached the maximum number of uses"
    );
  }

  await prisma.$transaction([
    prisma.inviteToken.update({
      where: { id: inviteToken.id },
      data: { uses: { increment: 1 } },
    }),
    prisma.membership.create({
      data: { userId, classroomId: inviteToken.classroomId, role: "assistant" },
    }),
    // Joining also switches you into the classroom; this used to update only
    // the JWT, leaving `User.currentClassroomId` behind.
    prisma.user.update({
      where: { id: userId },
      data: { currentClassroomId: inviteToken.classroomId },
    }),
  ]);

  await createAuthSession(userId, inviteToken.classroomId);

  return { success: true };
});
