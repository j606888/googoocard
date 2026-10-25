import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIdToken } from "@/lib/line";
import { buildStudentDetailPayload } from "@/service/studentDetail";
import { resolveCheckinClassroom } from "@/service/checkin";

// Student LIFF "我的課卡" data source. Auth is a LIFF-issued ID token in the
// Authorization header (students have no cookie/session) — NOT the teacher
// session used by /api/line/liff-login.
//
// A LINE account can be bound to multiple students across classrooms:
//   - ?studentId= absent, 0 bound   → 403 not_bound
//   - ?studentId= absent, 1 bound   → that student's full detail
//   - ?studentId= absent, N bound   → { needsSelection: true, students: [...] }
//   - ?studentId= present           → that student's detail, only if it belongs
//                                      to this LINE account (else 403)
//
// ?key= (the on-site QR's Classroom.checkinKey) scopes all of the above to that
// classroom: scanning classroom X's poster means acting as your student in X.
// 0 bound there → 403 not_bound with what the「第一次來嗎？」screen pre-fills.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  let classroomId: number | undefined;
  let classroomName: string | undefined;
  if (key) {
    const classroom = await resolveCheckinClassroom(key);
    if (!classroom || classroom.deletedAt) {
      return NextResponse.json({ error: "invalid_key" }, { status: 404 });
    }
    classroomId = classroom.id;
    classroomName = classroom.name;
  }

  const students = await prisma.student.findMany({
    where: {
      lineUserId: verified.userId,
      archivedAt: null,
      ...(classroomId ? { classroomId } : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      classroom: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });

  if (students.length === 0) {
    return NextResponse.json(
      key
        ? {
            error: "not_bound",
            classroomName,
            lineName: verified.name ?? null,
            linePicture: verified.picture ?? null,
          }
        : { error: "not_bound" },
      { status: 403 }
    );
  }

  const requestedId = Number(url.searchParams.get("studentId"));

  // Pick the target student: the requested one (if it belongs to this account),
  // or the only one when there's no ambiguity.
  let targetId: number | null = null;
  if (requestedId) {
    if (!students.some((s) => s.id === requestedId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    targetId = requestedId;
  } else if (students.length === 1) {
    targetId = students[0].id;
  }

  if (targetId === null) {
    return NextResponse.json({ needsSelection: true, students });
  }

  const payload = await buildStudentDetailPayload(targetId);
  if (!payload) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Include the full bound-students list so the LIFF gate can offer「切換學生」
  // without an extra request.
  return NextResponse.json({ ...payload, boundStudents: students });
}
