import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { maxUses } = await request.json();

  if (!classroomId) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  await prisma.inviteToken.create({
    data: {
      classroomId,
      maxUses,
      uses: 0,
      token: nanoid(8)
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const { classroomId } = await decodeAuthToken();
  const inviteTokens = await prisma.inviteToken.findMany({
    where: {
      classroomId,
    },
  });
  return NextResponse.json(inviteTokens);
}
