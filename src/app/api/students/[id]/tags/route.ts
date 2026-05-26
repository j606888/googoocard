import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const { tagName } = await request.json();

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tagName?.trim()) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }

  const tag = await prisma.tag.upsert({
    where: { name_classroomId: { name: tagName.trim(), classroomId } },
    create: { name: tagName.trim(), classroomId },
    update: {},
  });

  const studentTag = await prisma.studentTag.upsert({
    where: { studentId_tagId: { studentId: parseInt(id), tagId: tag.id } },
    create: { studentId: parseInt(id), tagId: tag.id },
    update: {},
    include: { tag: true },
  });

  return NextResponse.json(studentTag);
}
