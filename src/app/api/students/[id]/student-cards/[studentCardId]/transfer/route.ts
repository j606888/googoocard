import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { transferStudentCardSchema } from "@/lib/schemas";
import { canBuyCard, toDanceLevels } from "@/domains/qualification";
import { performTransfer } from "@/service/studentCardTransfer";

// 課卡轉讓 — 一張還沒用完的卡，剩餘堂數整批給同教室的另一位學生。
//
// 這支只負責驗證與授權；實際寫入在 performTransfer
// (`src/service/studentCardTransfer.ts`)。
type Params = { id: string; studentCardId: string };

export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const studentId = parseId(params.id, "student id");
  const sourceCardId = parseId(params.studentCardId, "student card id");
  const { toStudentId, note } = await parseBody(request, transferStudentCardSchema);

  const sourceCard = await prisma.studentCard.findUnique({
    where: { id: sourceCardId },
    include: {
      card: true,
      student: { select: { classroomId: true, name: true } },
    },
  });

  // Scope to the caller's classroom — 404 to avoid leaking existence.
  if (!sourceCard || sourceCard.student.classroomId !== classroomId) {
    throw notFound("Student card");
  }
  if (sourceCard.studentId !== studentId) {
    throw badRequest("CARD_STUDENT_MISMATCH", "Student card does not belong to the student");
  }
  if (sourceCard.expiredAt || sourceCard.convertedToId || sourceCard.transferredToId) {
    throw badRequest("CARD_EXPIRED", "Student card already ended");
  }
  if (sourceCard.remainingSessions <= 0) {
    throw badRequest("CARD_NO_SESSIONS", "Student card has no remaining sessions");
  }
  // 新卡一律視為已付清；讓未付款的卡轉讓會讓那筆欠款憑空消失（同轉換）。
  if (!sourceCard.isPaid) {
    throw badRequest("CARD_UNPAID", "Student card must be paid before transfer");
  }
  // 體驗課卡是給「這個人」第一次來用的，轉給別人就變成免費的課。
  if (sourceCard.card.isTrial) {
    throw badRequest("CARD_TRIAL", "Trial cards cannot be transferred");
  }
  if (toStudentId === studentId) {
    throw badRequest("SAME_STUDENT", "Cannot transfer a card to the same student");
  }

  const toStudent = await prisma.student.findFirst({
    where: { id: toStudentId, classroomId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!toStudent) throw notFound("Student");
  if (toStudent.archivedAt) {
    throw badRequest("STUDENT_ARCHIVED", "Cannot transfer a card to an archived student");
  }

  // 複習卡：接收的人要有資格，跟購買同一條規則 — 不能用轉讓繞過。
  if (sourceCard.card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: toStudent.id },
    });
    const decision = canBuyCard(sourceCard.card, toDanceLevels(qualifications));
    if (!decision.allowed) {
      throw decision.reason === "NOT_QUALIFIED"
        ? new ApiError(403, "STUDENT_NOT_QUALIFIED")
        : new ApiError(422, "CARD_MISSING_DANCE_TYPE");
    }
  }

  const created = await performTransfer({
    sourceCard,
    toStudent,
    note,
    actorUserId: userId,
  });
  // 同一張卡被同時轉讓／停用，搶輸的這邊什麼都沒寫。
  if (!created) throw badRequest("CARD_EXPIRED", "Student card already ended");
  return created;
});
