import { Prisma } from "@prisma/client";

// 退格（取消點名、重設點名、退缺席、合併學員的重複出席）。

/** 轉換／轉讓鏈最多跟幾層（防資料成環）。 */
const MAX_HOPS = 50;

/**
 * 把 `sessions` 格退回 `studentCardId`，回傳實際退到的卡 id。
 *
 * 財務開啟的教室：那張卡已經轉換或轉讓 → 順著 convertedToId／transferredToId 退到鏈尾那張
 * （剩餘價值跟著新卡走；退回舊卡的話那份錢不在預收也不在過期收入，會憑空消失）。
 * 鏈尾那張已過期也照退——它的過期收入會變，鎖住的月份由月結調整處理。
 * 財務沒開：照舊退回原本那張卡。
 */
export async function refundSessionsInTx(
  tx: Prisma.TransactionClient,
  studentCardId: number,
  sessions: number
): Promise<number> {
  const card = await tx.studentCard.findUniqueOrThrow({
    where: { id: studentCardId },
    select: { convertedToId: true, transferredToId: true, student: { select: { classroom: { select: { financeEnabledAt: true } } } } },
  });
  let targetId = studentCardId;
  if (card.student.classroom.financeEnabledAt) {
    let next = card.convertedToId ?? card.transferredToId;
    for (let hops = 0; next !== null && hops < MAX_HOPS; hops++) {
      targetId = next;
      const successor = await tx.studentCard.findUniqueOrThrow({
        where: { id: next },
        select: { convertedToId: true, transferredToId: true },
      });
      next = successor.convertedToId ?? successor.transferredToId;
    }
  }
  await tx.studentCard.update({
    where: { id: targetId },
    data: { remainingSessions: { increment: sessions } },
  });
  return targetId;
}
