import prisma from "@/lib/prisma";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { notifyUsers } from "@/service/push";
import type { RemittanceInput } from "@/domains/finance/schemas";
import { holderInHand } from "./money";
import { assertRevenueOwner, dateKeyToDate, requireReady } from "./setting";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

async function findInClassroom(classroomId: number, id: number) {
  const row = await prisma.financeRemittance.findFirst({ where: { id, classroomId } });
  if (!row) throw notFound("Remittance");
  return row;
}

function fields(input: RemittanceInput) {
  return {
    amount: input.amount,
    method: input.method,
    reference: input.method === "TRANSFER" ? input.reference : null,
    sentOn: dateKeyToDate(input.sentOn),
    note: input.note,
  };
}

/** 送回主堡：金額不能超過手上的錢。送出後推播給營收負責人。 */
export async function createRemittance(classroomId: number, userId: number, input: RemittanceInput) {
  const { setting, inHand } = await holderInHand(classroomId, userId);
  if (setting.revenueOwnerUserId === userId) throw badRequest("OWNER_CANNOT_REMIT", "營收負責人收的錢直接算進大水庫");
  if (input.amount > inHand) throw badRequest("AMOUNT_EXCEEDS_HAND", `手上只有 ${money(inHand)}`);
  const row = await prisma.financeRemittance.create({
    data: { classroomId, fromUserId: userId, ...fields(input) },
    include: { fromUser: { select: { name: true } } },
  });
  if (setting.revenueOwnerUserId) {
    await notifyUsers(classroomId, [setting.revenueOwnerUserId], {
      type: "FINANCE_REMITTANCE",
      title: `${row.fromUser.name} 送錢來了`,
      body: `${money(row.amount)}（${row.method === "CASH" ? "現金" : "轉帳"}），等你確認`,
      path: "/finance",
    });
  }
  return row;
}

/** 送的人改：轉交中的直接改；被退回的改完重新送出。 */
export async function updateRemittance(classroomId: number, userId: number, id: number, input: RemittanceInput) {
  const row = await findInClassroom(classroomId, id);
  if (row.fromUserId !== userId) throw new ApiError(403, "NOT_SENDER", "只有送的人可以改");
  if (row.status !== "PENDING" && row.status !== "REJECTED") throw new ApiError(409, "REMITTANCE_CLOSED", "這筆已經確認或撤回了");
  const { setting, inHand } = await holderInHand(classroomId, userId);
  const available = inHand + (row.status === "PENDING" ? row.amount : 0);
  if (input.amount > available) throw badRequest("AMOUNT_EXCEEDS_HAND", `手上只有 ${money(available)}`);
  const updated = await prisma.financeRemittance.updateMany({
    where: { id, status: row.status },
    data: { ...fields(input), status: "PENDING", reviewedById: null, reviewedAt: null, rejectReason: null },
  });
  if (updated.count === 0) throw new ApiError(409, "REMITTANCE_CHANGED", "這筆剛剛被處理了，重新整理看看");
  if (row.status === "REJECTED" && setting.revenueOwnerUserId) {
    const from = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await notifyUsers(classroomId, [setting.revenueOwnerUserId], {
      type: "FINANCE_REMITTANCE",
      title: `${from.name} 重新送錢來了`,
      body: `${money(input.amount)}，等你確認`,
      path: "/finance",
    });
  }
  return prisma.financeRemittance.findUniqueOrThrow({ where: { id } });
}

/** 送的人撤回（確認之前）。 */
export async function withdrawRemittance(classroomId: number, userId: number, id: number) {
  const row = await findInClassroom(classroomId, id);
  if (row.fromUserId !== userId) throw new ApiError(403, "NOT_SENDER", "只有送的人可以撤回");
  const updated = await prisma.financeRemittance.updateMany({
    where: { id, status: { in: ["PENDING", "REJECTED"] } },
    data: { status: "WITHDRAWN" },
  });
  if (updated.count === 0) throw new ApiError(409, "REMITTANCE_CLOSED", "這筆已經確認或撤回了");
  return { ok: true };
}

async function review(
  classroomId: number,
  userId: number,
  id: number,
  outcome: { status: "CONFIRMED" } | { status: "REJECTED"; reason: string }
) {
  const setting = await requireReady(classroomId);
  assertRevenueOwner(setting, userId);
  const row = await findInClassroom(classroomId, id);
  const updated = await prisma.financeRemittance.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: outcome.status,
      reviewedById: userId,
      reviewedAt: new Date(),
      rejectReason: outcome.status === "REJECTED" ? outcome.reason : null,
    },
  });
  if (updated.count === 0) throw new ApiError(409, "REMITTANCE_NOT_PENDING", "這筆已經不是等確認的狀態");
  await notifyUsers(classroomId, [row.fromUserId], {
    type: "FINANCE_REMITTANCE",
    title: outcome.status === "CONFIRMED" ? "錢收到了" : "繳回被退回",
    body:
      outcome.status === "CONFIRMED"
        ? `${money(row.amount)} 已經進大水庫`
        : `${money(row.amount)}：${outcome.reason}`,
    path: `/finance/holders/${row.fromUserId}`,
  });
  return prisma.financeRemittance.findUniqueOrThrow({ where: { id } });
}

export const confirmRemittance = (classroomId: number, userId: number, id: number) =>
  review(classroomId, userId, id, { status: "CONFIRMED" });

export const rejectRemittance = (classroomId: number, userId: number, id: number, reason: string) =>
  review(classroomId, userId, id, { status: "REJECTED", reason });
