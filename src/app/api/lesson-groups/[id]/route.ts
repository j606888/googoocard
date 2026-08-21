import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonGroupInClassroom } from "@/lib/authz";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const groupId = parseInt(id);
  if (!(await findLessonGroupInClassroom(groupId, classroomId))) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const group = await prisma.lessonGroup.update({
    where: { id: groupId },
    data: { name: name.trim() },
  });

  return NextResponse.json(group);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const groupId = parseInt(id);
  if (!(await findLessonGroupInClassroom(groupId, classroomId))) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Lesson.groupId has ON DELETE SET NULL — member lessons fall back to the
  // virtual 未分類 bucket automatically, no manual cleanup needed here.
  await prisma.lessonGroup.delete({ where: { id: groupId } });

  return NextResponse.json({ success: true });
}
