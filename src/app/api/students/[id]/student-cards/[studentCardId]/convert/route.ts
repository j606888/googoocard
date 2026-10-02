import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { convertStudentCardSchema } from "@/lib/schemas";
import { canBuyCard } from "@/domains/qualification";
import { performConversion } from "@/service/studentCardConversion";
import { residualValueOf, suggestConversion } from "@/domains/cardConversion";

// 課卡轉換 — 把一張還沒用完的舊卡換成另一種卡（Level 1 升級成 Level 2、
// 複習卡 3 堂折抵成 1 堂 Level 2）。
//
// 這支只負責驗證與授權；實際寫入在 performConversion
// (`src/service/studentCardConversion.ts`)，與批次轉換腳本共用同一份語意。
type Params = { id: string; studentCardId: string };

export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const studentId = parseId(params.id, "student id");
  const sourceCardId = parseId(params.studentCardId, "student card id");
  const { targetCardId, sessions, note } = await parseBody(request, convertStudentCardSchema);

  const sourceCard = await prisma.studentCard.findUnique({
    where: { id: sourceCardId },
    include: {
      card: true,
      student: { select: { classroomId: true } },
    },
  });

  // Scope to the caller's classroom — 404 to avoid leaking existence.
  if (!sourceCard || sourceCard.student.classroomId !== classroomId) {
    throw notFound("Student card");
  }

  if (sourceCard.studentId !== studentId) {
    throw badRequest("CARD_STUDENT_MISMATCH", "Student card does not belong to the student");
  }
  if (sourceCard.expiredAt) {
    throw badRequest("CARD_EXPIRED", "Student card already expired");
  }
  if (sourceCard.convertedToId) {
    throw badRequest("CARD_ALREADY_CONVERTED", "Student card already converted");
  }
  if (sourceCard.remainingSessions <= 0) {
    throw badRequest("CARD_NO_SESSIONS", "Student card has no remaining sessions");
  }
  // 新卡一律視為已付清；讓未付款的卡轉換會讓那筆欠款憑空消失（2026-10-02 定案）。
  if (!sourceCard.isPaid) {
    throw badRequest("CARD_UNPAID", "Student card must be paid before conversion");
  }

  const targetCard = await prisma.card.findFirst({
    where: { id: targetCardId, classroomId },
  });
  if (!targetCard) throw notFound("Card");

  // 轉成複習卡時，資格照購買規則擋 — 不能用轉換繞過。
  if (targetCard.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: sourceCard.studentId },
    });
    const decision = canBuyCard(
      targetCard,
      qualifications.map((q) => q.danceType)
    );
    if (!decision.allowed) {
      throw decision.reason === "NOT_QUALIFIED"
        ? new ApiError(403, "STUDENT_NOT_QUALIFIED")
        : new ApiError(422, "CARD_MISSING_DANCE_TYPE");
    }
  }

  // 預設堂數 = 剩餘價值依新卡牌價換算後四捨五入（與轉換表單的建議值同一份規則）。
  // 呼叫端指定的堂數不設上限：超過換算值等於加贈，UI 只提醒不擋 ——
  // 補償／加碼是正當情境（2026-10-02 定案）。
  const newSessions =
    sessions ??
    suggestConversion({
      residualValue: residualValueOf(sourceCard),
      targetPrice: targetCard.price,
      targetSessions: targetCard.sessions,
    }).suggested;

  return performConversion({
    sourceCard,
    targetCard,
    sessions: newSessions,
    note,
    actorUserId: userId,
  });
});
