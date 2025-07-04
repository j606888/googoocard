import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuthSession, decodeAuthToken } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id: token } = await params;
  const { userId, classroomId } = await decodeAuthToken();

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { token },
  });

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!inviteToken) {
    return NextResponse.json(
      { error: "Invite token not found" },
      { status: 404 }
    );
  }

  if (inviteToken.classroomId === classroomId) {
    return NextResponse.json(
      { error: "You are already a member of this classroom" },
      { status: 400 }
    );
  }

  if (inviteToken.maxUses && inviteToken.uses >= inviteToken.maxUses) {
    return NextResponse.json(
      { error: "Invite token has reached the maximum number of uses" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.inviteToken.update({
      where: { id: inviteToken.id },
      data: { uses: inviteToken.uses + 1 },
    });

    await tx.membership.create({
      data: {
        userId: userId,
        classroomId: inviteToken.classroomId,
        role: "assistant",
      },
    });
    await createAuthSession(userId, inviteToken.classroomId);
  });

  return NextResponse.json({ success: true });
}
