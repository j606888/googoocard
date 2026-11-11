import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findLessonGroupInClassroom } from "@/lib/authz";

/**
 * 課種頁：每一期上過課的學生（`LessonStudent`，點名時建立）。
 * 只回名單需要的欄位——不要把學生整列攤出去（lineBindKey 之類，見 roadmap 的 IDOR 紀錄）。
 */
export const GET = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  const groupId = parseInt(params.id);
  if (!(await findLessonGroupInClassroom(groupId, classroomId))) throw notFound("Group");

  const lessons = await prisma.lesson.findMany({
    where: { groupId, classroomId },
    select: {
      id: true,
      students: {
        orderBy: { createdAt: "asc" },
        select: { student: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  return {
    lessons: lessons.map((lesson) => ({
      lessonId: lesson.id,
      students: lesson.students.map((s) => s.student),
    })),
  };
});
