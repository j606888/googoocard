import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";
import { unbindStudentLine } from "@/service/lineBinding";

type Params = { id: string };

// 解除 LINE 綁定 — for when the binding link reached the wrong person. The
// student can bind again with a fresh link; see unbindStudentLine().
export const DELETE = apiRoute<Params>(async ({ params, classroomId, userId }) => {
  const student = await prisma.student.findFirst({
    where: { id: parseId(params.id, "student id"), classroomId },
    select: { id: true, lineUserId: true },
  });
  if (!student) throw notFound("Student");
  if (!student.lineUserId) throw badRequest("NOT_BOUND", "Student has no LINE binding");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await unbindStudentLine(student.id, user?.name ?? "老師");
  return { ok: true };
});
