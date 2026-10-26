import prisma from "@/lib/prisma";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { nextCardSerial } from "@/service/studentCardSerial";
import { appendNote } from "@/service/studentCardConversion";
import { residualValueOf } from "@/domains/cardConversion";
import { formatCardSerial } from "@/lib/cardSerial";

// 課卡轉讓：一張還沒用完的卡，剩下的堂數整批給同教室的另一位學生
// （2026-10-26 定案：不能只轉一部分）。
//
// 跟轉換同一個形狀：對方拿到一張同卡種的新卡（總堂數 = 轉過去的堂數），
// 舊卡停用並用 transferredToId 指向新卡。沒有金流 —— 新卡帶走舊卡的剩餘價值、
// 標記 origin = TRANSFER，課卡營收與下課對帳都只算 PURCHASE，所以同一筆錢
// 不會被認列兩次；每日營收依 finalPrice / totalSessions 攤提，單堂價跟舊卡一樣。
//
// 呼叫端負責授權、classroom scoping 與資格檢查；這裡只做寫入。

type TransferSourceCard = {
  id: number;
  serialNumber: number;
  studentId: number;
  cardId: number;
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
  note: string | null;
  card: { name: string; classroomId: number };
  student: { name: string };
};

export async function performTransfer({
  sourceCard,
  toStudent,
  note,
  actorUserId,
}: {
  sourceCard: TransferSourceCard;
  toStudent: { id: number; name: string };
  note?: string | null;
  actorUserId?: number | null;
}) {
  const sessions = sourceCard.remainingSessions;
  const residualValue = residualValueOf(sourceCard);
  const reason = typeof note === "string" && note.trim() ? note.trim() : null;
  const sourceSerial = formatCardSerial(sourceCard.serialNumber);
  const classroomId = sourceCard.card.classroomId;

  const created = await prisma.$transaction(async (tx) => {
    // 搶先把舊卡標成已轉讓：兩個請求同時轉同一張卡時，第二個會更新 0 列。
    const claimed = await tx.studentCard.updateMany({
      where: { id: sourceCard.id, expiredAt: null, convertedToId: null, transferredToId: null },
      data: { expiredAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const serialNumber = await nextCardSerial(tx, classroomId);
    const targetSerial = formatCardSerial(serialNumber);

    const newCard = await tx.studentCard.create({
      data: {
        serialNumber,
        studentId: toStudent.id,
        cardId: sourceCard.cardId,
        // 不是折扣，basePrice 跟著實際帶過來的價值走，學生的「省下」才不會灌水。
        basePrice: residualValue,
        finalPrice: residualValue,
        totalSessions: sessions,
        remainingSessions: sessions,
        purchaseSource: "STAFF",
        purchasedByUserId: actorUserId ?? null,
        origin: "TRANSFER",
        note: reason,
        // 錢在原卡收過了：視為已付清（不進未付款清單），但沒有收款人。
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: null,
      },
    });

    // remainingSessions 刻意不歸零，跟停用、轉換一致 ——「轉讓了幾堂」就是它。
    await tx.studentCard.update({
      where: { id: sourceCard.id },
      data: {
        transferredToId: newCard.id,
        ...(reason ? { note: appendNote(sourceCard.note, reason) } : {}),
      },
    });

    await tx.event.createMany({
      data: [
        {
          title: "課卡轉讓",
          description: `${sourceSerial}「${sourceCard.card.name}」剩餘 ${sessions} 堂轉讓給 ${toStudent.name}（${targetSerial}）`,
          studentId: sourceCard.studentId,
          resourceType: "studentCard",
          resourceId: sourceCard.id,
        },
        {
          title: "課卡轉讓",
          description: `${sourceCard.student.name} 的 ${sourceSerial} 轉入 ${sessions} 堂（${targetSerial}「${sourceCard.card.name}」）`,
          studentId: toStudent.id,
          resourceType: "studentCard",
          resourceId: newCard.id,
        },
      ],
    });

    return newCard;
  });

  if (created) {
    // 依序跑：兩個都可能是教室第一次需要「Needs Renewal」tag，並行會搶著建。
    await refreshNeedsRenewalTag(sourceCard.studentId, classroomId);
    await refreshNeedsRenewalTag(toStudent.id, classroomId);
  }

  return created;
}
