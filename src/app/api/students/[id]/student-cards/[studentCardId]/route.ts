import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Delete a StudentCard outright — used for buy-mistake cleanup. Only allowed
// while the card has never been consumed (no AttendanceRecords). Once a session
// has been signed in, the card must be expired instead, not deleted.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: { _count: { select: { attendanceRecords: true } } },
  });

  if (!studentCard) {
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
