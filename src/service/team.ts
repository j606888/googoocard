import { Prisma, type InviteToken } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/roles";
import { canTeach, firstFreeTeacherColor, kindForRole } from "@/lib/teachers";

type Db = Prisma.TransactionClient | typeof prisma;

export function isAssignableRole(role: unknown): role is AssignableRole {
  return typeof role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/**
 * A teacher id an admin wants to link someone to: in this classroom and not
 * already somebody else's. `forUserId` is who it'll be linked to (null while
 * still an invite) — re-linking the same person is fine.
 */
export async function findLinkableTeacher(
  db: Db,
  classroomId: number,
  teacherId: number,
  forUserId: number | null
) {
  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, classroomId },
    select: { id: true, userId: true, archivedAt: true },
  });
  if (!teacher) {
    throw badRequest("TEACHER_NOT_FOUND", "Teacher not found in this classroom");
  }
  if (teacher.userId !== null && teacher.userId !== forUserId) {
    throw new ApiError(409, "TEACHER_ALREADY_LINKED", "This teacher is already linked to another member");
  }
  return teacher;
}

/**
 * Point `userId`'s teacher profile in this classroom at `teacherId`, or drop it
 * with null. A user has at most one per classroom (`@@unique([classroomId, userId])`),
 * so any previous link is cleared first.
 */
export async function linkTeacher(
  tx: Prisma.TransactionClient,
  classroomId: number,
  userId: number,
  teacherId: number | null
) {
  if (teacherId !== null) {
    await findLinkableTeacher(tx, classroomId, teacherId, userId);
  }
  const previous = await tx.teacher.findMany({
    where: { classroomId, userId, ...(teacherId !== null && { id: { not: teacherId } }) },
    select: { id: true },
  });
  await tx.teacher.updateMany({
    where: { id: { in: previous.map((p) => p.id) } },
    data: { userId: null },
  });
  if (teacherId !== null) {
    await tx.teacher.update({ where: { id: teacherId }, data: { userId } });
  }
  // 改連到別筆的時候，舊的那筆多半是加入時自動建的：併進新的那筆（小幫手紀錄搬過去、那筆刪掉），
  // 免得名冊多一個同名的人。舊的那筆自己就是教過課的老師時不併，只是不再連到帳號。
  for (const { id } of previous) {
    if (teacherId !== null) await mergePersonInto(tx, id, teacherId);
    else await archiveIfUnused(tx, id);
  }
}

/**
 * 把 `fromId` 這筆人員資料併進 `toId`：協助過的課（和教過的課）改掛到 `toId`，
 * 然後刪掉 `fromId`。`fromId` 是老師（老師／老師＋小幫手，老師頁上看得到的）時不併、
 * 只封存沒上過課的——那是另一位老師，不是加入時自動建的小幫手／不上課那筆。
 */
export async function mergePersonInto(tx: Prisma.TransactionClient, fromId: number, toId: number) {
  const from = await tx.teacher.findUniqueOrThrow({ where: { id: fromId }, select: { kind: true } });
  const [taught, assisted] = await Promise.all([
    tx.lessonTeacher.findMany({ where: { teacherId: fromId }, select: { id: true, lessonId: true } }),
    tx.lessonAssistant.findMany({ where: { teacherId: fromId }, select: { id: true, lessonId: true } }),
  ]);
  if (canTeach(from.kind)) {
    await archiveIfUnused(tx, fromId);
    return;
  }
  const lessonIds = [...taught, ...assisted].map((row) => row.lessonId);
  const [targetTaught, targetAssisted] = await Promise.all([
    tx.lessonTeacher.findMany({ where: { teacherId: toId, lessonId: { in: lessonIds } }, select: { lessonId: true } }),
    tx.lessonAssistant.findMany({ where: { teacherId: toId, lessonId: { in: lessonIds } }, select: { lessonId: true } }),
  ]);
  const teaches = new Set(targetTaught.map((row) => row.lessonId));
  const assists = new Set(targetAssisted.map((row) => row.lessonId));

  for (const row of taught) {
    if (teaches.has(row.lessonId)) {
      await tx.lessonTeacher.delete({ where: { id: row.id } });
      continue;
    }
    // 一堂課的老師不會同時是它的小幫手。
    if (assists.has(row.lessonId)) {
      await tx.lessonAssistant.deleteMany({ where: { lessonId: row.lessonId, teacherId: toId } });
    }
    await tx.lessonTeacher.update({ where: { id: row.id }, data: { teacherId: toId } });
    teaches.add(row.lessonId);
  }
  for (const row of assisted) {
    if (teaches.has(row.lessonId) || assists.has(row.lessonId)) {
      await tx.lessonAssistant.delete({ where: { id: row.id } });
    } else {
      await tx.lessonAssistant.update({ where: { id: row.id }, data: { teacherId: toId } });
    }
  }
  await tx.inviteToken.updateMany({ where: { teacherId: fromId }, data: { teacherId: toId } });
  await tx.teacher.delete({ where: { id: fromId } });
}

/**
 * 每個成員都要有一筆人員資料（團隊與老師合併，2026-11）。沒有就用帳號名字建一筆，
 * 身分照角色（`kindForRole`）。加入教室、建立教室時呼叫。
 */
export async function ensurePerson(
  tx: Prisma.TransactionClient,
  classroomId: number,
  userId: number,
  role: string
) {
  const existing = await tx.teacher.findFirst({ where: { classroomId, userId }, select: { id: true } });
  if (existing) return existing.id;
  const [user, taken] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    tx.teacher.findMany({ where: { classroomId, archivedAt: null }, select: { color: true } }),
  ]);
  const created = await tx.teacher.create({
    data: {
      classroomId,
      userId,
      name: user.name.trim() || "成員",
      color: firstFreeTeacherColor(taken),
      kind: kindForRole(role),
    },
    select: { id: true },
  });
  return created.id;
}

/** 沒教過也沒協助過課的人員資料就封存（不刪：名字、顏色留著，要用再打開）。 */
async function archiveIfUnused(db: Db, teacherId: number) {
  const [taught, assisted] = await Promise.all([
    db.lessonTeacher.count({ where: { teacherId } }),
    db.lessonAssistant.count({ where: { teacherId } }),
  ]);
  if (taught === 0 && assisted === 0) {
    await db.teacher.updateMany({
      where: { id: teacherId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  }
}

/**
 * 成員離開或被移出：人員資料留著（舊課還掛著他），只是不再連到帳號；
 * 沒上過課的順便封存，名冊上就不會留一個沒帳號、也不上課的人。
 */
export async function unlinkTeacher(tx: Prisma.TransactionClient, classroomId: number, userId: number) {
  const linked = await tx.teacher.findMany({ where: { classroomId, userId }, select: { id: true } });
  await tx.teacher.updateMany({ where: { classroomId, userId }, data: { userId: null } });
  for (const { id } of linked) await archiveIfUnused(tx, id);
}

/**
 * Turn a validated invite into a membership: the invite's role, its person
 * link (skipped quietly if that person got linked to someone else since), one
 * use spent. Without a link — or if it was skipped — the joiner gets a new
 * person record (`ensurePerson`).
 */
export async function redeemInvite(
  tx: Prisma.TransactionClient,
  userId: number,
  invite: Pick<InviteToken, "id" | "classroomId" | "role" | "teacherId">
) {
  const role = isAssignableRole(invite.role) ? invite.role : "assistant";
  await tx.inviteToken.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
  await tx.membership.create({ data: { userId, classroomId: invite.classroomId, role } });
  const alreadyLinked = await tx.teacher.findFirst({
    where: { classroomId: invite.classroomId, userId },
    select: { id: true },
  });
  if (invite.teacherId !== null && !alreadyLinked) {
    await tx.teacher.updateMany({
      where: { id: invite.teacherId, classroomId: invite.classroomId, userId: null },
      data: { userId, archivedAt: null },
    });
  }
  await ensurePerson(tx, invite.classroomId, userId, role);
}
