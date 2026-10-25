import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";
import { findMembership } from "@/lib/authz";
import { confirmPaymentSchema } from "@/lib/schemas";

const PAYMENT_METHOD_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

// Mark a previously-unpaid StudentCard as paid, recording WHO confirmed it
// (often a different person than who opened the card — e.g. assistant opens,
// owner confirms after receiving cash). The optional body records HOW it was
// paid and WHO now holds the money (`receiverUserId`, defaults to the caller) —
// an empty body (older App builds) still confirms.
type Params = { id: string; studentCardId: string };

export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const studentId = parseId(params.id, "student id");
  const cardId = parseId(params.studentCardId, "student card id");
  const raw = await request.text();
  let json: unknown = {};
  if (raw.trim()) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw badRequest("INVALID_JSON", "Request body must be valid JSON");
    }
  }
  const body = confirmPaymentSchema.parse(json);

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

  const receiverUserId = body.receiverUserId ?? userId;
  if (receiverUserId !== userId && !(await findMembership(receiverUserId, classroomId))) {
    throw badRequest("RECEIVER_NOT_MEMBER", "Receiver is not a member of this classroom");
  }
  const paymentReference = body.paymentReference || null;

  // Flipping the flag and recording the event are one unit — an unrecorded
  // payment confirmation is exactly the kind of gap this flow exists to close.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.studentCard.update({
      where: { id: studentCard.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: receiverUserId,
        paymentMethod: body.paymentMethod ?? null,
        paymentReference,
      },
    });

    await tx.event.create({
      data: {
        title: "確認付款",
        description: [
          `確認付款 ${studentCard.card.name}（$${studentCard.finalPrice}）`,
          body.paymentMethod && PAYMENT_METHOD_LABEL[body.paymentMethod],
          paymentReference && `末五碼 ${paymentReference}`,
        ]
          .filter(Boolean)
          .join(" · "),
        studentId,
        resourceType: "studentCard",
        resourceId: studentCard.id,
      },
    });

    return updated;
  });
});
