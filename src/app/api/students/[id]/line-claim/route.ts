import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { confirmLineSelfClaim } from "@/service/lineBinding";

type Params = { id: string };

// 「沒問題」on a LINE self-claim in 待處理: the student who claimed this record at
// the on-site QR is the right person. (Wrong person → DELETE .../line-binding.)
export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  const student = await prisma.student.findFirst({
    where: { id: parseId(params.id, "student id"), classroomId },
    select: { id: true },
  });
  if (!student) throw notFound("Student");
  await confirmLineSelfClaim(student.id);
  return { ok: true };
});
