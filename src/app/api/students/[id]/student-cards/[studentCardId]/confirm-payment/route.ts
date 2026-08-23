import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";

// Mark a previously-unpaid StudentCard as paid, recording WHO confirmed it
// (often a different person than who opened the card — e.g. assistant opens,
// owner confirms after receiving cash).
type Params = { id: string; studentCardId: string };

export const POST = apiRoute<Params>(async ({ params, userId, classroomId }) => {
  const studentId = parseId(params.id, "student id");
  const cardId = parseId(params.studentCardId, "student card id");

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: cardId },
    include: { card: true, student: { select: { classroomId: true } } },
  });

  // Scope to the caller's classroom — a (studentId, studentCardId) pair from
  // another classroom must not be operable. 404 to avoid leaking existence.
  if (!studentCard || studentCard.student.classroomId !== classroomId) {
    throw notFound("Student card");
  }

  if (studentCard.studentId !== studentId) {
    throw badRequest("CARD_STUDENT_MISMATCH", "Student card does not belong to the student");
  }

  if (studentCard.isPaid) {
    throw badRequest("ALREADY_PAID");
  }

  // Flipping the flag and recording the event are one unit — an unrecorded
  // payment confirmation is exactly the kind of gap this flow exists to close.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.studentCard.update({
      where: { id: studentCard.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: userId,
      },
    });

    await tx.event.create({
      data: {
        title: "確認付款",
        description: `確認付款 ${studentCard.card.name}（$${studentCard.finalPrice}）`,
        studentId,
        resourceType: "studentCard",
        resourceId: studentCard.id,
      },
    });

    return updated;
  });
});
