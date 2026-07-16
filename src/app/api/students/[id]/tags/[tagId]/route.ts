import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const { id, tagId } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!(await findStudentInClassroom(parseInt(id), classroomId))) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  await prisma.studentTag.deleteMany({
    where: { studentId: parseInt(id), tagId: parseInt(tagId) },
  });
  return NextResponse.json({ success: true });
}
