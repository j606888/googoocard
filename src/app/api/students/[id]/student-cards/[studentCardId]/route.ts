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
      _count: { select: { attendanceRecords: true, convertedFrom: true, absences: true } },
      transferredFrom: { select: { id: true } },
      // 綁課卡附送的贈送卡（財務）
      gifts: {
        select: {
          id: true,
          convertedToId: true,
          transferredToId: true,
          _count: { select: { attendanceRecords: true, absences: true } },
        },
      },
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

  // 缺席扣過格也算用過（財務綁課卡）。
  if (studentCard._count.attendanceRecords > 0 || studentCard._count.absences > 0) {
    return NextResponse.json(
      { error: "Card has been used; expire it instead of deleting" },
      { status: 400 }
    );
  }

  // 轉換／轉讓鏈上的卡：刪掉任一端，另一端的「來自」「已轉讓給」就斷了，
  // 轉入的堂數也會跟著消失。
  if (
    studentCard.convertedToId ||
    studentCard.transferredToId ||
    studentCard.transferredFrom ||
    studentCard._count.convertedFrom > 0
  ) {
    return NextResponse.json(
      { error: "Card is part of a conversion or transfer; expire it instead of deleting" },
      { status: 400 }
    );
  }

  // 綁課卡附送的贈送卡：沒用過就一起刪（買錯卡，贈送卡也不該留著）；用過了就擋下。
  const giftUsed = studentCard.gifts.some(
    (g) =>
      g._count.attendanceRecords > 0 ||
      g._count.absences > 0 ||
      g.convertedToId !== null ||
      g.transferredToId !== null
  );
  if (giftUsed) {
    return NextResponse.json(
      {
        code: "GIFT_USED",
        error: "這張卡附送的贈送卡已經用過，不能刪除；請改用「停用」",
      },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.studentCard.deleteMany({ where: { giftFromId: studentCard.id } }),
    prisma.studentCard.delete({ where: { id: studentCard.id } }),
  ]);

  return NextResponse.json({ success: true });
}
