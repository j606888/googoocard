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
