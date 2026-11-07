import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  fetchLineProfile,
  isLinePicture,
  isReplaceableByLinePicture,
  LINE_PICTURE_PREFIXES,
  PRESET_AVATAR_PREFIX,
  type LineProfile,
} from "@/lib/lineProfile";
import { DEFAULT_STUDENT_AVATAR } from "@/service/student";

/** Event titles on the student's 動態 timeline (EventTimeline.helpers.ts draws them). */
export const LINE_BOUND_EVENT = "綁定 LINE";
export const LINE_UNBOUND_EVENT = "解除 LINE 綁定";

type BindTarget = { id: number; name: string; classroomId: number; avatarUrl: string };

function lineEvent(tx: Prisma.TransactionClient, studentId: number, title: string, description: string) {
  return tx.event.create({
    data: { title, description, studentId, resourceType: "student", resourceId: studentId },
  });
}

/** Everything that came from LINE goes with the binding — a LINE picture included. */
function releasedLine(avatarUrl: string) {
  return {
    lineUserId: null,
    lineDisplayName: null,
    lineSelfClaimedAt: null,
    ...(isLinePicture(avatarUrl) ? { avatarUrl: DEFAULT_STUDENT_AVATAR } : {}),
  };
}

const nameNote = (name: string | null) => (name ? `LINE 名稱「${name}」` : null);

/**
 * Bind `lineUserId` to `student` and log it on the timeline, with the account's
 * LINE name (`profile`, looked up when not given) so a binding to the wrong
 * person is visible; its picture replaces a preset avatar. One LINE account can
 * bind students in different classrooms but only one per classroom, so another
 * student it already has here is released (and gets its own 解除 event). The
 * one-time `lineBindKey` is consumed, which keeps re-sending the same key idempotent.
 * `how` describes the binding when there's no LINE name to show.
 */
export async function bindStudentLine(
  student: BindTarget,
  lineUserId: string,
  how: string,
  profile?: LineProfile | null
) {
  // Outside the transaction: it's a network call to LINE.
  const line = profile === undefined ? await fetchLineProfile(lineUserId) : profile;

  return prisma.$transaction(async (tx) => {
    const previous = await tx.student.findFirst({
      where: { lineUserId, classroomId: student.classroomId, id: { not: student.id } },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (previous) {
      await tx.student.update({ where: { id: previous.id }, data: releasedLine(previous.avatarUrl) });
      await lineEvent(tx, previous.id, LINE_UNBOUND_EVENT, `這個 LINE 改綁到「${student.name}」`);
    }
    await tx.student.update({
      where: { id: student.id },
      data: {
        lineUserId,
        lineBindKey: null,
        lineDisplayName: line?.displayName ?? null,
        // A binding the teacher handed out is already confirmed.
        lineSelfClaimedAt: null,
        ...(line?.pictureUrl && isReplaceableByLinePicture(student.avatarUrl) ? { avatarUrl: line.pictureUrl } : {}),
      },
    });
    const notes = [nameNote(line?.displayName ?? null), previous && `原本綁在「${previous.name}」`];
    await lineEvent(tx, student.id, LINE_BOUND_EVENT, notes.filter(Boolean).join(" · ") || how);
    // The bot menu follows the student the account last bound or picked.
    await tx.lineAccount.upsert({
      where: { lineUserId },
      update: { selectedStudentId: student.id },
      create: { lineUserId, selectedStudentId: student.id },
    });
    return { previous };
  });
}

export class ClaimError extends Error {
  constructor(public code: "already_bound" | "not_found") {
    super(code);
  }
}

/**
 * 「我來上過課」：a LINE account with no student in this classroom picks itself
 * from the unbound roster at the on-site QR and is bound straight away, so it
 * can check in now and use the LINE menu from then on. Anyone could pick anyone,
 * so it's marked `lineSelfClaimedAt` and listed in the teacher's 待處理 until
 * confirmed (`confirmLineSelfClaim`) or undone (`unbindStudentLine`).
 *
 * Only an unbound, in-class student can be claimed — a bound one can't be taken
 * over — and the check happens under a row lock so two people can't claim the
 * same student at once.
 */
export async function claimStudentLine(
  classroomId: number,
  studentId: number,
  lineUserId: string,
  line: LineProfile | null
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Student"
      WHERE id = ${studentId} AND "classroomId" = ${classroomId} AND "archivedAt" IS NULL
      FOR UPDATE`;
    if (rows.length === 0) throw new ClaimError("not_found");

    const [student, mine] = await Promise.all([
      tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: { id: true, name: true, avatarUrl: true, lineUserId: true },
      }),
      tx.student.findFirst({ where: { classroomId, lineUserId, archivedAt: null }, select: { id: true } }),
    ]);
    if (student.lineUserId) throw new ClaimError("already_bound");
    // This account already has a student here — the gate never offers a claim then.
    if (mine) throw new ClaimError("already_bound");

    await tx.student.update({
      where: { id: studentId },
      data: {
        lineUserId,
        lineBindKey: null,
        lineDisplayName: line?.displayName || null,
        lineSelfClaimedAt: new Date(),
        ...(line?.pictureUrl && isReplaceableByLinePicture(student.avatarUrl) ? { avatarUrl: line.pictureUrl } : {}),
      },
    });
    const notes = ["掃現場 QR 從名單認領", nameNote(line?.displayName || null)];
    await lineEvent(tx, studentId, LINE_BOUND_EVENT, notes.filter(Boolean).join(" · "));
    await tx.lineAccount.upsert({
      where: { lineUserId },
      update: { menuMode: "STUDENT", selectedStudentId: studentId },
      create: { lineUserId, menuMode: "STUDENT", selectedStudentId: studentId },
    });
    return { id: student.id, name: student.name };
  });
}

/** Teacher checked a self-claim in 待處理 and it's the right person. */
export async function confirmLineSelfClaim(studentId: number) {
  await prisma.student.update({ where: { id: studentId }, data: { lineSelfClaimedAt: null } });
}

/**
 * Teacher-side 解除綁定 — for a link sent to the wrong person. The student goes
 * back to unbound: the LINE name and a LINE picture are dropped, the next 綁定連結
 * carries a fresh key (the old one was consumed on bind) and the 未綁定 LINE list
 * shows them as not yet invited. The LINE side needs no cleanup:
 * `currentStudent()` / `resolveOwnedStudent()` match on `lineUserId`, so that
 * account simply stops seeing this student.
 */
export async function unbindStudentLine(studentId: number, byName: string) {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId },
      select: { avatarUrl: true, lineDisplayName: true },
    });
    await tx.student.update({
      where: { id: studentId },
      data: { ...releasedLine(student.avatarUrl), lineBindKey: null, lineInviteSentAt: null },
    });
    const notes = [`${byName} 在後台解除`, nameNote(student.lineDisplayName)];
    await lineEvent(tx, studentId, LINE_UNBOUND_EVENT, notes.filter(Boolean).join(" · "));
  });
}

/**
 * Keep the students bound to this LINE account in step with its profile — the
 * LIFF ID token carries the current name and picture on every open. A changed
 * LINE picture replaces the old one; a preset avatar is replaced only the first
 * time we learn the profile (no name yet, i.e. bound before names were
 * recorded), so a teacher who later picks a preset again keeps it.
 */
export async function syncLineProfile(lineUserId: string, { name, picture }: { name?: string; picture?: string }) {
  if (picture) {
    await prisma.student.updateMany({
      where: {
        lineUserId,
        NOT: { avatarUrl: picture },
        OR: [
          ...LINE_PICTURE_PREFIXES.map((prefix) => ({ avatarUrl: { startsWith: prefix } })),
          { lineDisplayName: null, avatarUrl: { startsWith: PRESET_AVATAR_PREFIX } },
        ],
      },
      data: { avatarUrl: picture },
    });
  }
  if (name) {
    await prisma.student.updateMany({
      where: { lineUserId, OR: [{ lineDisplayName: null }, { lineDisplayName: { not: name } }] },
      data: { lineDisplayName: name },
    });
  }
}
