import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { generateRandomKey, bindDeepLink } from "@/lib/line";

// Returns a LINE deep link the teacher can copy and send to a student.
// When the student taps it, the official-account chat opens with the student's
// one-time binding key pre-filled — sending it binds their LINE account.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findFirst({
    where: { id: parseInt(id), classroomId },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (student.lineUserId) {
    return NextResponse.json({ bound: true });
  }

  let key = student.lineBindKey;
  if (!key) {
    key = generateRandomKey();
    await prisma.student.update({ where: { id: student.id }, data: { lineBindKey: key } });
  }

  return NextResponse.json({ bound: false, key, deepLink: bindDeepLink(key) });
}
