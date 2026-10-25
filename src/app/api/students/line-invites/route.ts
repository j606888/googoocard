import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { lastAttendanceQuery, toLastAttendance } from "@/service/studentDetail";
import { lineInviteMessage, studentBindLink } from "@/service/lineInvite";

// 「未綁定 LINE 的學員」：上課前先邀請綁好，現場就只剩第一次來的人要幫忙。
// Active students only; most recently attended first (they're the ones who'll
// show up next), never-attended last. Each row carries its ready-to-paste
// invite so the copy button can write to the clipboard synchronously — iOS
// Safari drops clipboard writes that happen after an await.
export const GET = apiRoute(async ({ classroomId }) => {
  const [boundCount, totalCount, students] = await Promise.all([
    prisma.student.count({ where: { classroomId, archivedAt: null, lineUserId: { not: null } } }),
    prisma.student.count({ where: { classroomId, archivedAt: null } }),
    prisma.student.findMany({
      where: { classroomId, archivedAt: null, lineUserId: null },
      select: {
        id: true,
        number: true,
        name: true,
        avatarUrl: true,
        lineUserId: true,
        lineBindKey: true,
        lineInviteSentAt: true,
        attendanceRecords: lastAttendanceQuery,
      },
    }),
  ]);

  const rows = await Promise.all(
    students.map(async ({ attendanceRecords, lineUserId, lineBindKey, ...student }) => {
      const link = await studentBindLink({ id: student.id, lineUserId, lineBindKey });
      const deepLink = link.bound ? null : link.deepLink;
      return {
        ...student,
        lastAttendAt: toLastAttendance(attendanceRecords).lastAttendAt,
        inviteMessage: deepLink ? lineInviteMessage(student.name, deepLink) : null,
      };
    })
  );
  rows.sort((a, b) => (b.lastAttendAt?.getTime() ?? 0) - (a.lastAttendAt?.getTime() ?? 0));

  return { boundCount, totalCount, students: rows };
});
