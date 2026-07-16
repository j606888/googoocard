import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;
  const { classroomId } = await decodeAuthToken();

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: { student: { select: { classroomId: true } } },
  });

  // Scope to the caller's classroom — a (studentId, studentCardId) pair from
  // another classroom must not be operable. 404 to avoid leaking existence.
  if (!studentCard || studentCard.student.classroomId !== classroomId) {
    return NextResponse.json(
      { error: "Student card not found" },
      { status: 404 }
    );
  }

  if (studentCard.expiredAt) {
    return NextResponse.json(
      { error: "Student card already expired" },
      { status: 400 }
    );
  }

  if (studentCard.studentId !== parseInt(id)) {
    return NextResponse.json(
      { error: "Student card does not belong to the student" },
      { status: 400 }
    );
  }

  await prisma.studentCard.update({
    where: { id: parseInt(studentCardId) },
    data: { expiredAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
