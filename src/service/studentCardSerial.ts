import { Prisma } from "@prisma/client";

// 發下一個課卡流水號（Classroom.nextCardSerial），必須在建卡的同一個
// transaction 裡呼叫。計數器 update 的 row lock 會把同教室的並發建卡排隊，
// 所以不會發出重複號碼 —— StudentCard 沒有 classroomId，沒辦法靠 DB unique
// 當最後防線，這個 lock 就是唯一保證。顯示格式見 src/lib/cardSerial.ts。
export async function nextCardSerial(tx: Prisma.TransactionClient, classroomId: number) {
  const classroom = await tx.classroom.update({
    where: { id: classroomId },
    data: { nextCardSerial: { increment: 1 } },
    select: { nextCardSerial: true },
  });
  return classroom.nextCardSerial - 1;
}
