import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  await prisma.inviteToken.delete({
    where: { id: parseInt(id), classroomId },
  });
  return NextResponse.json({ success: true });
}