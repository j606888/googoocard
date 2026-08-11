import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { canBuyCard } from "@/domains/qualification";

// 課卡轉換 — 把一張還沒用完的舊卡換成另一種卡（Level 1 升級成 Level 2、
// 複習卡 3 堂折抵成 1 堂 Level 2）。
//
// 沒有金流：新卡直接繼承舊卡的「剩餘價值」(單堂價 × 剩餘堂數)，並標記
// origin = CONVERSION 讓課卡月營收把它排除，否則同一筆錢會被認列兩次。
// 每日營收 (finalPrice / totalSessions) 則照常攤提，所以整體營收守恆 —
// 複習卡 3 堂折 1 堂時，那 1 堂會認列原本 3 堂的金額，這是刻意的。
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

  // 舊卡的剩餘價值 — 已經上過的堂數已認列在過去的每日營收裡，不再帶過來。
  const residualValue = Math.round(
    (sourceCard.finalPrice / sourceCard.totalSessions) * sourceCard.remainingSessions
  );

  const sourceNote = appendNote(
    sourceCard.note,
    `已轉換為「${targetCard.name}」${newSessions} 堂（剩餘 ${sourceCard.remainingSessions} 堂），故停用。`
  );
  const targetNote =
    typeof note === "string" && note.trim()
      ? note.trim()
      : `由「${sourceCard.card.name}」剩餘 ${sourceCard.remainingSessions} 堂轉換而來。`;

  const newStudentCard = await prisma.$transaction(async (tx) => {
    const created = await tx.studentCard.create({
      data: {
        studentId: sourceCard.studentId,
        cardId: targetCard.id,
        basePrice: targetCard.price,
        finalPrice: residualValue,
        totalSessions: newSessions,
        remainingSessions: newSessions,
        purchaseSource: "STAFF",
        purchasedByUserId: userId ?? null,
        origin: "CONVERSION",
        note: targetNote,
        // 轉換沒有金流，直接視為已付清，否則會跑進未付款催收清單。
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: userId ?? null,
      },
    });

    // 停用舊卡並留下轉換鏈。remainingSessions 刻意不歸零，跟一般停用一致，
    // 保留「當初剩幾堂」這個事實。
    await tx.studentCard.update({
      where: { id: sourceCard.id },
      data: {
        expiredAt: new Date(),
        convertedToId: created.id,
        note: sourceNote,
      },
    });

    await tx.event.create({
      data: {
        title: "課卡轉換",
        description: `「${sourceCard.card.name}」轉換為「${targetCard.name}」${newSessions} 堂`,
        studentId: sourceCard.studentId,
        resourceType: "studentCard",
        resourceId: created.id,
      },
    });

    return created;
  });

  await refreshNeedsRenewalTag(sourceCard.studentId, targetCard.classroomId);

  return NextResponse.json(newStudentCard);
}

function appendNote(existing: string | null, addition: string) {
  return existing ? `${existing}\n${addition}` : addition;
}
