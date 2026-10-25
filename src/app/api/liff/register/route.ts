import { NextResponse } from "next/server";
import { bearerToken } from "@/lib/liffAuth";
import { verifyIdToken } from "@/lib/line";
import { resolveCheckinClassroom } from "@/service/checkin";
import { DEFAULT_STUDENT_AVATAR, registerLineStudent } from "@/service/student";

// 「第一次來」：a LINE account with no student in this classroom scans the
// on-site QR (which carries Classroom.checkinKey) and creates its own student,
// bound to itself, with just a nickname. Idempotent — an account that already
// has a student here gets that one back.
//
// Same-name students are NOT rejected (unlike the teacher-side create): a
// newcomer can't know the roster. A clash shows up as「可能重複」in the
// teacher's 待處理 and is resolved by merging.
export async function POST(request: Request) {
  const verified = await verifyIdToken(bearerToken(request));
  if (!verified) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const { key, name } = (await request.json().catch(() => ({}))) as { key?: string; name?: string };
  const classroom = await resolveCheckinClassroom(String(key ?? ""));
  if (!classroom || classroom.deletedAt) {
    return NextResponse.json({ error: "invalid_key" }, { status: 404 });
  }

  const trimmed = String(name ?? "").trim();
  if (!trimmed || trimmed.length > 30) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const { student, created } = await registerLineStudent(classroom.id, {
    lineUserId: verified.userId,
    name: trimmed,
    avatarUrl: verified.picture || DEFAULT_STUDENT_AVATAR,
  });

  return NextResponse.json({ id: student.id, name: student.name, created });
}
