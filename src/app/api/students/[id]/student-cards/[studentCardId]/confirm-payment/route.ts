import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";
import { findMembership } from "@/lib/authz";
import { confirmPaymentSchema } from "@/lib/schemas";
import { isFinanceEnabled } from "@/service/finance/access";
import { assertReceiverIsCustodian, defaultReceiver, soldLocationFor } from "@/service/finance/receiver";

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

  const finance = await isFinanceEnabled(classroomId);
  // 財務開啟：收款人必須是保管人，並記下賣卡分部（預設 = 收款人保管的分部）。
  const receiverUserId = finance
    ? body.receiverUserId ?? (await defaultReceiver(classroomId, userId))
    : body.receiverUserId ?? userId;
  if (!finance && receiverUserId !== userId && !(await findMembership(receiverUserId, classroomId))) {
    throw badRequest("RECEIVER_NOT_MEMBER", "Receiver is not a member of this classroom");
  }
  let soldLocationId: number | null | undefined;
  if (finance) {
    if (!(await findMembership(receiverUserId, classroomId))) {
      throw badRequest("RECEIVER_NOT_MEMBER", "Receiver is not a member of this classroom");
    }
    await assertReceiverIsCustodian(receiverUserId, classroomId);
    if (body.soldLocationId) {
      const loc = await prisma.location.findFirst({
        where: { id: body.soldLocationId, classroomId },
        select: { id: true },
      });
      if (!loc) throw badRequest("INVALID_LOCATION", "Location not in this classroom");
      soldLocationId = loc.id;
    } else {
      soldLocationId = await soldLocationFor(classroomId, receiverUserId);
    }
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
        ...(finance ? { soldLocationId } : {}),
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
