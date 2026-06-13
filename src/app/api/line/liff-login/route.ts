import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuthSession } from "@/lib/auth";
import { verifyIdToken } from "@/lib/line";

// Called from the /liff page with a LIFF-issued ID token. Verifies it with
// LINE, finds the User bound to that LINE account, and starts a session.
export async function POST(request: Request) {
  const { idToken } = await request.json().catch(() => ({}));

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { lineUserId: verified.userId },
    include: { memberships: true },
  });
  if (!user) {
    // Bound on LINE side but no matching account — needs to bind first.
    return NextResponse.json({ error: "not_bound" }, { status: 403 });
  }

  const classroomId =
    user.currentClassroomId ?? user.memberships[0]?.classroomId ?? undefined;
  await createAuthSession(user.id, classroomId);

  return NextResponse.json({ ok: true });
}
