import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken } from "@/lib/liffAuth";
import { verifyIdToken } from "@/lib/line";
import { resolveCheckinClassroom } from "@/service/checkin";
import { claimStudentLine, ClaimError } from "@/service/lineBinding";

// 「我來上過課」at the on-site QR: a LINE account with no student in this
// classroom finds itself in the roster and binds itself (see claimStudentLine).
//
// GET ?key=&q=  → up to 8 unbound, in-class students whose name contains q.
//                  Needs a search term — the roster is never listed whole, so a
//                  stranger scanning the poster can't read everyone's name.
// POST { key, studentId } → bind; 409 already_bound if someone got there first.

const MAX_RESULTS = 8;

async function authorize(request: Request, key: string) {
  const verified = await verifyIdToken(bearerToken(request));
  if (!verified) return { error: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };
  const classroom = await resolveCheckinClassroom(key);
  if (!classroom || classroom.deletedAt) {
    return { error: NextResponse.json({ error: "invalid_key" }, { status: 404 }) };
  }
  return { verified, classroom };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await authorize(request, url.searchParams.get("key") ?? "");
  if ("error" in auth) return auth.error;

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 30);
  if (!q) return NextResponse.json({ students: [] });

  const now = new Date();
  const students = await prisma.student.findMany({
    where: {
      classroomId: auth.classroom.id,
      archivedAt: null,
      lineUserId: null,
      name: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      studentCards: {
        where: { remainingSessions: { gt: 0 }, OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] },
        select: { remainingSessions: true },
      },
    },
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
  });

  return NextResponse.json({
    students: students.map(({ studentCards, ...s }) => ({
      ...s,
      remainingSessions: studentCards.reduce((sum, c) => sum + c.remainingSessions, 0),
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { key?: string; studentId?: number };
  const auth = await authorize(request, String(body.key ?? ""));
  if ("error" in auth) return auth.error;

  const studentId = Number(body.studentId);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "invalid_student" }, { status: 400 });
  }

  try {
    const student = await claimStudentLine(auth.classroom.id, studentId, auth.verified.userId, {
      displayName: auth.verified.name ?? "",
      pictureUrl: auth.verified.picture,
    });
    return NextResponse.json(student);
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json(
        { error: err.code },
        { status: err.code === "not_found" ? 404 : 409 }
      );
    }
    throw err;
  }
}
