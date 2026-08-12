import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { canBuyCard } from "@/domains/qualification";
import { performConversion } from "@/service/studentCardConversion";

// 課卡轉換 — 把一張還沒用完的舊卡換成另一種卡（Level 1 升級成 Level 2、
// 複習卡 3 堂折抵成 1 堂 Level 2）。
//
// 這支只負責驗證與授權；實際寫入在 performConversion
// (`src/service/studentCardConversion.ts`)，與批次轉換腳本共用同一份語意。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;
  const { userId, classroomId } = await decodeAuthToken();
  const { targetCardId, sessions, note } = await request.json();

  const sourceCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: {
      card: true,
      student: { select: { classroomId: true } },
    },
  });

  // Scope to the caller's classroom — 404 to avoid leaking existence.
  if (!sourceCard || sourceCard.student.classroomId !== classroomId) {
    return NextResponse.json({ error: "Student card not found" }, { status: 404 });
  }

  if (sourceCard.studentId !== parseInt(id)) {
    return NextResponse.json(
      { error: "Student card does not belong to the student" },
      { status: 400 }
    );
  }

  if (sourceCard.expiredAt) {
    return NextResponse.json(
      { error: "Student card already expired" },
      { status: 400 }
    );
  }

  if (sourceCard.convertedToId) {
    return NextResponse.json(
      { error: "Student card already converted" },
      { status: 400 }
    );
  }

  if (sourceCard.remainingSessions <= 0) {
    return NextResponse.json(
      { error: "Student card has no remaining sessions" },
      { status: 400 }
    );
  }

  const targetCard = await prisma.card.findUnique({
    where: { id: parseInt(String(targetCardId)) },
  });

  if (!targetCard || targetCard.classroomId !== classroomId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

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
      if (decision.reason === "NOT_QUALIFIED") {
        return NextResponse.json({ error: "STUDENT_NOT_QUALIFIED" }, { status: 403 });
      }
      return NextResponse.json({ error: "CARD_MISSING_DANCE_TYPE" }, { status: 422 });
    }
  }

  // 預設等堂轉換 (Level 1 → Level 2)；複習卡折抵則由呼叫端指定較少的堂數。
  const newSessions = sessions === undefined ? sourceCard.remainingSessions : sessions;
  if (!Number.isInteger(newSessions) || newSessions < 1) {
    return NextResponse.json({ error: "Invalid sessions" }, { status: 400 });
  }

  const newStudentCard = await performConversion({
    sourceCard,
    targetCard,
    sessions: newSessions,
    note,
    actorUserId: userId,
  });

  return NextResponse.json(newStudentCard);
}
