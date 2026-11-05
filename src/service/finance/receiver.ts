import prisma from "@/lib/prisma";
import { badRequest } from "@/lib/apiError";

/** 這個人在教室裡是不是保管人（Membership.isCustodian）。 */
export async function isCustodian(userId: number, classroomId: number): Promise<boolean> {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { isCustodian: true },
  });
  return !!m?.isCustodian;
}

/** 財務開啟時，收款人必須是保管人，否則 400 RECEIVER_NOT_FINANCE。 */
export async function assertReceiverIsCustodian(userId: number, classroomId: number): Promise<void> {
  if (!(await isCustodian(userId, classroomId))) {
    throw badRequest("RECEIVER_NOT_FINANCE", "Receiver must be a custodian");
  }
}

/**
 * 沒指定收款人時的預設：呼叫者是保管人就用呼叫者；否則用這堂課所在分部的
 * 保管人（keeper）。找不到就 400 RECEIVER_REQUIRED。
 */
export async function defaultReceiver(
  classroomId: number,
  callerUserId: number,
  lessonLocationId?: number | null
): Promise<number> {
  if (await isCustodian(callerUserId, classroomId)) return callerUserId;
  if (lessonLocationId) {
    const loc = await prisma.location.findFirst({
      where: { id: lessonLocationId, classroomId },
      select: { keeperUserId: true },
    });
    if (loc?.keeperUserId && (await isCustodian(loc.keeperUserId, classroomId))) {
      return loc.keeperUserId;
    }
  }
  throw badRequest("RECEIVER_REQUIRED", "Choose a custodian to receive the payment");
}

/** 收款人是哪個分部的 keeper → 該分部；不是任何 keeper → null。 */
export async function soldLocationFor(classroomId: number, receiverUserId: number): Promise<number | null> {
  const loc = await prisma.location.findFirst({
    where: { classroomId, keeperUserId: receiverUserId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return loc?.id ?? null;
}
