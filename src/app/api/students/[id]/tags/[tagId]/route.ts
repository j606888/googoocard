import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const { id, tagId } = await params;
  await prisma.studentTag.deleteMany({
    where: { studentId: parseInt(id), tagId: parseInt(tagId) },
  });
  return NextResponse.json({ success: true });
}
