import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";

// Cards a student can purchase from the LIFF「購買課卡」page. Auth is a LIFF ID
// token (Bearer header); the student is resolved + ownership-checked via
// resolveOwnedStudent. Returns the active cards of that student's classroom;
// qualification filtering (hiding unqualified practice cards) happens client-side.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = Number(url.searchParams.get("studentId"));

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const cards = await prisma.card.findMany({
    where: { classroomId: resolved.student.classroomId, expiredAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      sessions: true,
      isPracticeCard: true,
      danceType: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cards);
}
