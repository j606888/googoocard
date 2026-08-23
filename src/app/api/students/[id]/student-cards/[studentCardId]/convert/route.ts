import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { convertStudentCardSchema } from "@/lib/schemas";
import { canBuyCard } from "@/domains/qualification";
import { performConversion } from "@/service/studentCardConversion";

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

  // 預設等堂轉換 (Level 1 → Level 2)；複習卡折抵則由呼叫端指定較少的堂數。
  // 刻意不設上限：轉換沒有金流，理論上打錯字（6 打成 60）會憑空發課，
  // 但要不要擋是業務決定，不是驗證層該自作主張的 —— 見 docs/roadmap.md。
  const newSessions = sessions ?? sourceCard.remainingSessions;

  return performConversion({
    sourceCard,
    targetCard,
    sessions: newSessions,
    note,
    actorUserId: userId,
  });
});
