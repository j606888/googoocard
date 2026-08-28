import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { joinClassroom } from "@/service/classroom";
import { hit, reset, clientIp } from "@/lib/rateLimit";

// This endpoint distinguishes "email not found" from "wrong password" (a
// deliberate UX choice, see commit 0b04823), which makes it doubly worth
// throttling: unlimited tries would allow both account enumeration and
// password brute-forcing.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { email, password, token } = await request.json();

    // Key on email + IP: one attacker can't lock a real user out of their own
    // account from a different address, and one IP can't spray many emails.
    const limitKey = `login:${String(email).toLowerCase()}:${clientIp(request)}`;
    const limit = hit(limitKey, { limit: MAX_FAILURES, windowMs: WINDOW_MS });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        // Archived classrooms must not be a landing spot — every consumer of
        // this list treats it as "classrooms this user can enter".
        memberships: {
          where: { classroom: { deletedAt: null } },
          orderBy: { id: "asc" },
        },
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email not found", code: "EMAIL_NOT_FOUND" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Password incorrect", code: "INVALID_PASSWORD" },
        { status: 401 }
      );
    }

    // Succeeded — don't let earlier typos count against the next login.
    reset(limitKey);

    let classroomId: number | null = null;

    if (token) {
      classroomId = await joinClassroom({ userId: user.id, token });
    }

    // `memberships[0]` used to be read unguarded, so a user with no live
    // membership (signed up via an invite-less flow, or just left their last
    // classroom) got a 500 instead of being sent to onboarding.
    const stillAMember = user.memberships.some(
      (m) => m.classroomId === user.currentClassroomId
    );
    const currentClassroomId =
      classroomId ??
      (stillAMember ? user.currentClassroomId : null) ??
      user.memberships[0]?.classroomId ??
      undefined;

    await createAuthSession(user.id, currentClassroomId);

    return NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
