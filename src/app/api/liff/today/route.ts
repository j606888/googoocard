import { NextResponse } from "next/server";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import { getTodayLessons } from "@/service/checkin";

// Data source for the LIFF「上課簽到」page. Auth is a LIFF ID token; the student
// is resolved + ownership-checked via resolveOwnedStudent. Returns today's
// (Taipei) lessons in the student's classroom with each period flagged for
// whether this student already checked in — walk-in style, not limited to
// lessons they're enrolled in. When there's no class today, returns the next
// upcoming lesson so the page can show「下次上課」.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = Number(url.searchParams.get("studentId"));

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;

  const data = await getTodayLessons(student.classroomId, student.id);

  return NextResponse.json(data);
}
