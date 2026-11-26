import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { getTodos } from "@/service/todos";

/**
 * 待處理。`?scope=mine` 只留我的課（我教的＋我當小幫手的）；省略 = 全教室
 * （App 的原生待處理頁、推播數字都是全教室）。
 */
export const GET = apiRoute(async ({ request, classroomId, userId }) => {
  if (new URL(request.url).searchParams.get("scope") !== "mine") return getTodos(classroomId);
  const teacher = await prisma.teacher.findFirst({ where: { classroomId, userId }, select: { id: true } });
  // 沒連老師資料的人沒有「我的課」：-1 對不到任何課。
  return getTodos(classroomId, new Date(), { teacherId: teacher?.id ?? -1 });
});
