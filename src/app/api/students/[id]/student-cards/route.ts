import prisma from "@/lib/prisma";
import { findStudentInClassroom } from "@/lib/authz";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { buyStudentCardSchema } from "@/lib/schemas";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { canBuyCard } from "@/domains/qualification";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ params, classroomId }) => {
  // Ran with no auth at all until 2026-08-23 — any card balance was readable
  // by incrementing the student id.
  const student = await findStudentInClassroom(parseId(params.id, "student id"), classroomId);
  if (!student) throw notFound("Student");

  return prisma.studentCard.findMany({
    where: { studentId: student.id },
  });
});

export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const studentId = parseId(params.id, "student id");
  const { cardId, sessions, price, lessonId, isPaid } = await parseBody(
    request,
    buyStudentCardSchema
  );

  const student = await findStudentInClassroom(studentId, classroomId);
  if (!student) throw notFound("Student");

  // The card must be the caller's own classroom's too, or a card id from
  // another classroom could be attached to this student.
  const card = await prisma.card.findFirst({
    where: { id: cardId, classroomId },
  });
  if (!card) throw notFound("Card");

  if (card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId },
    });
    // Scoped: the lesson supplies the dance type that decides qualification,
    // so a foreign lesson id must not be able to unlock a practice card.
    const lesson = lessonId
      ? await prisma.lesson.findFirst({ where: { id: lessonId, classroomId } })
      : null;

    const decision = canBuyCard(
      card,
      qualifications.map((q) => q.danceType),
      lesson?.danceType
    );
    if (!decision.allowed) {
      throw decision.reason === "NOT_QUALIFIED"
        ? new ApiError(403, "STUDENT_NOT_QUALIFIED")
        : new ApiError(422, "CARD_MISSING_DANCE_TYPE");
    }
  }

  // The card row, its purchase Event and the renewal tag are one unit of work:
  // a card that exists with no Event leaves a gap in the student's timeline,
  // and a stale "Needs Renewal" tag tells the teacher to chase a student who
  // just paid.
  const studentCard = await prisma.$transaction(async (tx) => {
    const created = await tx.studentCard.create({
      data: {
        studentId,
        cardId,
        basePrice: card.price,
        finalPrice: price,
        // total and remaining must match at creation; both follow the (editable)
        // session count chosen at purchase, defaulting to the card's own sessions.
        totalSessions: sessions,
        remainingSessions: sessions,
        purchaseSource: "STAFF",
        purchasedByUserId: userId,
        isPaid,
        // When paid at point of sale, the seller is also the payment confirmer.
        paidAt: isPaid ? new Date() : null,
        paidByUserId: isPaid ? userId : null,
      },
    });

    await tx.event.create({
      data: {
        title: "購買課卡",
        description: `購買新課卡 ${card.name}`,
        studentId,
        resourceType: "studentCard",
        resourceId: created.id,
      },
    });

    return created;
  });

  await refreshNeedsRenewalTag(studentId, card.classroomId);

  return studentCard;
});
