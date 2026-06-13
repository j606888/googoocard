import prisma from "@/lib/prisma";
import { verifyIdToken } from "@/lib/line";
import type { Student } from "@prisma/client";

/** Extract the LIFF ID token from an `Authorization: Bearer <token>` header. */
export function bearerToken(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

type ResolveResult =
  | { ok: true; student: Student }
  | { ok: false; status: number; error: string };

/**
 * Resolve the student a LIFF request is acting on, enforcing ownership.
 *
 * Student LIFF calls carry a LINE ID token (not a teacher cookie) and an
 * explicit `studentId` (already resolved by LiffStudentGate). We verify the
 * token, then require that the target student's `lineUserId` equals the token's
 * sub — otherwise a bound user could operate on someone else's student.
 */
export async function resolveOwnedStudent(
  idToken: string,
  studentId: number,
): Promise<ResolveResult> {
  const verified = await verifyIdToken(idToken);
  if (!verified) return { ok: false, status: 401, error: "invalid_token" };
  if (!studentId) return { ok: false, status: 400, error: "missing_studentId" };

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.lineUserId !== verified.userId) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, student };
}
