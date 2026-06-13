import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";

// Persist the student the user picked in the LIFF identity switcher, so the LINE
// bot's flex menu shows the same student afterwards (the webhook reads
// LineAccount.selectedStudentId). Auth is a LIFF ID token; ownership enforced
// via resolveOwnedStudent — you can only select your own bound student.
export async function POST(request: Request) {
  const { studentId } = await request.json();

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;
  const lineUserId = student.lineUserId!; // guaranteed by resolveOwnedStudent

  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { selectedStudentId: student.id },
    create: { lineUserId, selectedStudentId: student.id },
  });

  return NextResponse.json({ ok: true });
}
