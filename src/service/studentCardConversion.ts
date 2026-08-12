import prisma from "@/lib/prisma";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

// 課卡轉換的實際寫入邏輯，由 convert API route 與一次性批次腳本共用 —— 兩邊
// 語意必須完全一致，所以只有這一份實作。
//
// 沒有金流：新卡繼承舊卡的「剩餘價值」(單堂價 × 剩餘堂數)，並標記
// origin = CONVERSION 讓課卡營收統計把它排除，否則同一筆錢會被認列兩次。
// 每日營收 (finalPrice / totalSessions) 則照常攤提，所以整體營收守恆 ——
// 複習卡 3 堂折 1 堂時，那 1 堂會認列原本 3 堂的金額，這是刻意的。
//
// 呼叫端負責授權與 classroom scoping；這裡只做寫入。

export type ConversionSourceCard = {
  id: number;
  studentId: number;
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
  note: string | null;
  card: { name: string };
};

export type ConversionTargetCard = {
  id: number;
  name: string;
  price: number;
  classroomId: number;
};

/** 舊卡剩餘價值 — 已經上過的堂數已認列在過去的每日營收裡，不再帶過來。 */
export function residualValueOf(sourceCard: {
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
}) {
  return Math.round(
    (sourceCard.finalPrice / sourceCard.totalSessions) * sourceCard.remainingSessions
  );
}

export function appendNote(existing: string | null, addition: string) {
  return existing ? `${existing}\n${addition}` : addition;
}

export async function performConversion({
  sourceCard,
  targetCard,
  sessions,
  note,
  actorUserId,
}: {
  sourceCard: ConversionSourceCard;
  targetCard: ConversionTargetCard;
  sessions: number;
  note?: string | null;
  actorUserId?: number | null;
}) {
  const residualValue = residualValueOf(sourceCard);

  const sourceNote = appendNote(
    sourceCard.note,
    `已轉換為「${targetCard.name}」${sessions} 堂（剩餘 ${sourceCard.remainingSessions} 堂），故停用。`
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
        totalSessions: sessions,
        remainingSessions: sessions,
        purchaseSource: "STAFF",
        purchasedByUserId: actorUserId ?? null,
        origin: "CONVERSION",
        note: targetNote,
        // 轉換沒有金流，直接視為已付清，否則會跑進未付款催收清單。
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: actorUserId ?? null,
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
        description: `「${sourceCard.card.name}」轉換為「${targetCard.name}」${sessions} 堂`,
        studentId: sourceCard.studentId,
        resourceType: "studentCard",
        resourceId: created.id,
      },
    });

    return created;
  });

  await refreshNeedsRenewalTag(sourceCard.studentId, targetCard.classroomId);

  return newStudentCard;
}
