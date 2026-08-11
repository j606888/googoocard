import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

const NOTE_MAX_LENGTH = 500;

// Edit the free-form note on a StudentCard. The same field is also written
// automatically by the conversion flow, so a manual edit can overwrite the
// system-generated text — that is intentional, the teacher has the final say.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;
  const { classroomId } = await decodeAuthToken();
  const { note } = await request.json();

  if (note !== null && typeof note !== "string") {
    return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  }
  if (typeof note === "string" && note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `備註不能超過 ${NOTE_MAX_LENGTH} 字` },
      { status: 400 }
    );
  }

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: { student: { select: { classroomId: true } } },
  });

  if (!studentCard || studentCard.student.classroomId !== classroomId) {
    return NextResponse.json({ error: "Student card not found" }, { status: 404 });
  }

  if (studentCard.studentId !== parseInt(id)) {
    return NextResponse.json(
      { error: "Student card does not belong to the student" },
      { status: 400 }
    );
  }

  // Empty string clears the note rather than storing "".
  const trimmed = typeof note === "string" ? note.trim() : null;
  const updated = await prisma.studentCard.update({
    where: { id: studentCard.id },
    data: { note: trimmed ? trimmed : null },
  });

  return NextResponse.json(updated);
}

// Delete a StudentCard outright — used for buy-mistake cleanup. Only allowed
// while the card has never been consumed (no AttendanceRecords). Once a session
// has been signed in, the card must be expired instead, not deleted.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;
  const { classroomId } = await decodeAuthToken();

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: {
      _count: { select: { attendanceRecords: true } },
      student: { select: { classroomId: true } },
    },
  });

  // Scope to the caller's classroom — a (studentId, studentCardId) pair from
  // another classroom must not be operable. 404 to avoid leaking existence.
  if (!studentCard || studentCard.student.classroomId !== classroomId) {
    return NextResponse.json(
      { error: "Student card not found" },
      { status: 404 }
    );
  }

  if (studentCard.studentId !== parseInt(id)) {
    return NextResponse.json(
      { error: "Student card does not belong to the student" },
      { status: 400 }
    );
  }

  if (studentCard._count.attendanceRecords > 0) {
    return NextResponse.json(
      { error: "Card has been used; expire it instead of deleting" },
      { status: 400 }
    );
  }

  await prisma.studentCard.delete({
    where: { id: studentCard.id },
  });

  return NextResponse.json({ success: true });
}
