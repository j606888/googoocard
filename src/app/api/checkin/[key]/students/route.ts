import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTodayLessons, resolveCheckinClassroom } from "@/service/checkin";

// Roster for the public QR check-in page — the student picks themselves from it,
// so it is readable by anyone who can see the wall poster. Two deliberate limits
// keep the exposure minimal:
//   1. only id / name / avatarUrl / number — no cards, balances, notes or share
//      keys; the classroom-scoped number is the same sensitivity as name/avatar
//      (an identifier, not a secret) and helps students find themselves faster;
//   2. empty when the classroom has no class today, so the poster URL is inert
//      on non-class days.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  const classroom = await resolveCheckinClassroom(key);
  if (!classroom) {
    return NextResponse.json({ error: "invalid_key" }, { status: 404 });
  }

  const { today } = await getTodayLessons(classroom.id);
  if (today.length === 0) {
    return NextResponse.json({ students: [] });
  }

  const students = await prisma.student.findMany({
    where: { classroomId: classroom.id },
    select: { id: true, name: true, avatarUrl: true, number: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ students });
}
