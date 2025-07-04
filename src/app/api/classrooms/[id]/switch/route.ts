import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuthSession, decodeAuthToken } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const { userId } = await decodeAuthToken();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: userId,
      classroomId: parseInt(id),
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await createAuthSession(userId, parseInt(id));

  return NextResponse.json({ message: "Classroom switched successfully" });
}
