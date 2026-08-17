import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTodayLessons, resolveCheckinClassroom } from "@/service/checkin";

// Board data for the public QR check-in page. The only credential is the
// classroom's `checkinKey` printed on the studio wall — unknown/rotated key →
// 404 without saying whether the classroom exists.
//
// `?studentId=` is optional and only used to flag periods the student already
// signed for, so the picker can grey them out; an id from another classroom is
// ignored rather than rejected.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  const classroom = await resolveCheckinClassroom(key);
  if (!classroom) {
    return NextResponse.json({ error: "invalid_key" }, { status: 404 });
  }

  const studentId = Number(new URL(request.url).searchParams.get("studentId"));
  let scopedStudentId: number | undefined;
  if (studentId) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classroomId: true },
    });
    if (student?.classroomId === classroom.id) scopedStudentId = studentId;
  }

  const data = await getTodayLessons(classroom.id, scopedStudentId);

  return NextResponse.json({ classroomName: classroom.name, ...data });
}
