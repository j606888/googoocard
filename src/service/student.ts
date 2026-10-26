import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

// Creates a student and assigns it the next per-classroom sequential
// number (Classroom.nextStudentNumber), atomically. The counter update's
// row-level lock serializes concurrent creates within the same classroom;
// the (classroomId, number) unique constraint on Student is the backstop.
export async function createStudent(
  classroomId: number,
  data: { name: string; avatarUrl: string; note?: string }
) {
  return prisma.$transaction(async (tx) => {
    const classroom = await tx.classroom.update({
      where: { id: classroomId },
      data: { nextStudentNumber: { increment: 1 } },
    });
    return tx.student.create({
      data: {
        ...data,
        classroomId,
        number: classroom.nextStudentNumber - 1,
        randomKey: nanoid(8),
      },
    });
  });
}

// A newcomer's preset avatar until they (or a teacher) pick another — the same
// default the teacher-side NewStudent form starts with.
export const DEFAULT_STUDENT_AVATAR = "/images/avatars/not-sure.png";

/**
 * Self-registration from the on-site check-in QR: create a student bound to
 * this LINE account in this classroom — or return the one it already has.
 *
 * The classroom row is locked first, so two taps of「下一步」(or a retry after
 * a flaky network) can't create two students, and the student-number counter
 * only advances when a student is actually created.
 */
export async function registerLineStudent(
  classroomId: number,
  {
    lineUserId,
    lineDisplayName,
    name,
    avatarUrl,
  }: { lineUserId: string; lineDisplayName: string | null; name: string; avatarUrl: string }
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Classroom" WHERE id = ${classroomId} FOR UPDATE`;

    const existing = await tx.student.findFirst({
      where: { classroomId, lineUserId, archivedAt: null },
    });
    if (existing) return { student: existing, created: false };

    const classroom = await tx.classroom.update({
      where: { id: classroomId },
      data: { nextStudentNumber: { increment: 1 } },
    });
    const student = await tx.student.create({
      data: {
        name,
        avatarUrl,
        lineUserId,
        lineDisplayName,
        classroomId,
        number: classroom.nextStudentNumber - 1,
        randomKey: nanoid(8),
      },
    });
    await tx.event.create({
      data: {
        title: "自助登記",
        description: "第一次來，掃現場 QR 用 LINE 建立資料",
        studentId: student.id,
        resourceType: "student",
        resourceId: student.id,
      },
    });
    // The LINE bot menu follows the student the account last used.
    await tx.lineAccount.upsert({
      where: { lineUserId },
      update: { menuMode: "STUDENT", selectedStudentId: student.id },
      create: { lineUserId, menuMode: "STUDENT", selectedStudentId: student.id },
    });
    return { student, created: true };
  });
}
