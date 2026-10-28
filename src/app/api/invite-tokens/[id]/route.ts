import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";

/** `members.manage` only, like creating one. */
export const DELETE = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  const id = parseId(params.id, "invite id");
  const { count } = await prisma.inviteToken.deleteMany({ where: { id, classroomId } });
  if (count === 0) {
    throw new ApiError(404, "INVITE_TOKEN_NOT_FOUND", "Invite token not found");
  }
  return { success: true };
}, { permission: "members.manage" });

// Public: the join page shows which classroom and role a link is for. Only
// those — this used to return the whole classroom row, check-in key included.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: token } = await params;
  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      role: true,
      classroomId: true,
      classroom: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(inviteToken);
}
