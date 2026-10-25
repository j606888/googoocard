import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";

type Params = { id: string };

// Records that the teacher just copied this student's LINE invite (the text
// comes with GET /api/students/line-invites). The system can't message someone
// who hasn't added the official account, so the teacher sends it themselves;
// we only keep the time so the list shows「已邀請」and nobody gets nagged twice.
export const POST = apiRoute<Params>(async ({ params, classroomId }) => {
  const student = await prisma.student.findFirst({
    where: { id: parseId(params.id, "student id"), classroomId },
    select: { id: true, lineUserId: true },
  });
  if (!student) throw notFound("Student");
  if (student.lineUserId) throw badRequest("ALREADY_BOUND", "Student already bound LINE");

  return prisma.student.update({
    where: { id: student.id },
    data: { lineInviteSentAt: new Date() },
    select: { id: true, lineInviteSentAt: true },
  });
});
