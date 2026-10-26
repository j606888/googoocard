import type { Student } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyIdToken } from "@/lib/line";
import { resolveOwnedStudent } from "@/lib/liffAuth";
import { resolveLineClassroom } from "@/service/lineBot";

export type LiffClassroomResult =
  | {
      ok: true;
      classroom: { id: number; name: string };
      /** Set when the caller acts as one of its own students in this classroom. */
      student: Student | null;
      /** Other public classrooms this (unbound) viewer could switch to. */
      listed: { id: number; name: string }[];
    }
  | { ok: false; status: number; error: string; classrooms?: { id: number; name: string }[] };

const listedClassrooms = () =>
  prisma.classroom.findMany({
    where: { lineListed: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

/**
 * Which classroom a read-only LIFF page (課表／課卡方案) shows. Unlike the student
 * pages these work for unbound visitors too — anyone who opens the LIFF from the
 * official account's menu.
 *
 *  - `studentId` → one of the caller's own students (ownership enforced); that classroom.
 *  - `classroomId` → a public (`lineListed`) classroom the caller picked; remembered as
 *    `LineAccount.browseClassroomId` so the chat bot shows the same one.
 *  - neither → the bot's own rule (`resolveLineClassroom`): bound student's classroom,
 *    then the remembered pick, then the only public one. Several public and no
 *    pick yet → 409 `pick_classroom` with the choices.
 */
export async function resolveLiffClassroom(
  idToken: string,
  opts: { studentId?: number; classroomId?: number }
): Promise<LiffClassroomResult> {
  if (opts.studentId) {
    const owned = await resolveOwnedStudent(idToken, opts.studentId);
    if (!owned.ok) return owned;
    const classroom = await prisma.classroom.findUnique({
      where: { id: owned.student.classroomId },
      select: { id: true, name: true, deletedAt: true },
    });
    if (!classroom || classroom.deletedAt) return { ok: false, status: 404, error: "not_found" };
    return { ok: true, classroom: { id: classroom.id, name: classroom.name }, student: owned.student, listed: [] };
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) return { ok: false, status: 401, error: "invalid_token" };
  const listed = await listedClassrooms();

  if (opts.classroomId) {
    const picked = listed.find((c) => c.id === opts.classroomId);
    if (!picked) return { ok: false, status: 404, error: "not_listed" };
    await prisma.lineAccount.upsert({
      where: { lineUserId: verified.userId },
      update: { browseClassroomId: picked.id },
      create: { lineUserId: verified.userId, browseClassroomId: picked.id },
    });
    return { ok: true, classroom: picked, student: null, listed };
  }

  const resolved = await resolveLineClassroom(verified.userId);
  if (resolved.kind === "pick") {
    return { ok: false, status: 409, error: "pick_classroom", classrooms: resolved.classrooms };
  }
  if (resolved.kind === "none") return { ok: false, status: 404, error: "no_public_classroom" };
  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: resolved.classroomId },
    select: { id: true, name: true },
  });
  // A bound student's classroom resolved without a studentId: still read-only, no student context.
  return { ok: true, classroom, student: null, listed: resolved.via === "student" ? [] : listed };
}
