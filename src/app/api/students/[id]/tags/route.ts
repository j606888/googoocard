import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";

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

  // The tag is classroom-scoped, but the student wasn't — a tag could be
  // attached to a student in someone else's classroom.
  const student = await findStudentInClassroom(parseInt(id), classroomId);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const tag = await prisma.tag.upsert({
    where: { name_classroomId: { name: tagName.trim(), classroomId } },
    create: { name: tagName.trim(), classroomId },
    update: {},
  });

  const studentTag = await prisma.studentTag.upsert({
    where: { studentId_tagId: { studentId: student.id, tagId: tag.id } },
    create: { studentId: student.id, tagId: tag.id },
    update: {},
    include: { tag: true },
  });

  return NextResponse.json(studentTag);
}
