import type { FinanceEntry, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, notFound } from "@/lib/apiError";
import type { EntryInput } from "@/domains/finance/schemas";
import { assertMembers, assertRevenueOwner, dateKeyToDate, requireReady } from "./setting";
import { toTaipeiDateKey } from "@/lib/taipei-date";

/** 大水庫的手記帳只有營收負責人能記、改、作廢。改和作廢要寫原因，留修改紀錄。 */

async function guard(classroomId: number, userId: number, input?: EntryInput) {
  const setting = await requireReady(classroomId);
  assertRevenueOwner(setting, userId);
  if (input?.payeeUserId) await assertMembers(classroomId, [input.payeeUserId]);
}

function data(input: EntryInput) {
  return {
    date: dateKeyToDate(input.date),
    category: input.category,
    amount: input.amount,
    payeeUserId: input.payeeUserId,
    payeeName: input.payeeName,
    description: input.description,
  };
}

function snapshot(e: FinanceEntry): Prisma.InputJsonValue {
  return {
    date: toTaipeiDateKey(e.date),
    category: e.category,
    amount: e.amount,
    payeeUserId: e.payeeUserId,
    payeeName: e.payeeName,
    description: e.description,
  };
}

async function findLive(classroomId: number, id: number) {
  const entry = await prisma.financeEntry.findFirst({ where: { id, classroomId } });
  if (!entry) throw notFound("Entry");
  if (entry.voidedAt) throw new ApiError(409, "ENTRY_VOIDED", "這筆已經作廢了");
  return entry;
}

export async function createEntry(classroomId: number, userId: number, input: EntryInput) {
  await guard(classroomId, userId, input);
  return prisma.financeEntry.create({ data: { classroomId, createdById: userId, ...data(input) } });
}

export async function updateEntry(classroomId: number, userId: number, id: number, input: EntryInput, reason: string) {
  await guard(classroomId, userId, input);
  const before = await findLive(classroomId, id);
  return prisma.$transaction(async (tx) => {
    const after = await tx.financeEntry.update({ where: { id }, data: data(input) });
    await tx.financeEntryRevision.create({
      data: { entryId: id, editedById: userId, reason, before: snapshot(before), after: snapshot(after) },
    });
    return after;
  });
}

export async function voidEntry(classroomId: number, userId: number, id: number, reason: string) {
  await guard(classroomId, userId);
  const before = await findLive(classroomId, id);
  return prisma.$transaction(async (tx) => {
    const after = await tx.financeEntry.update({ where: { id }, data: { voidedAt: new Date() } });
    await tx.financeEntryRevision.create({
      data: { entryId: id, editedById: userId, reason, before: snapshot(before) },
    });
    return after;
  });
}

/** 修改紀錄（大家都看得到）。 */
export async function entryHistory(classroomId: number, id: number) {
  const entry = await prisma.financeEntry.findFirst({ where: { id, classroomId }, select: { id: true } });
  if (!entry) throw notFound("Entry");
  return prisma.financeEntryRevision.findMany({
    where: { entryId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, before: true, after: true, createdAt: true, editedBy: { select: { id: true, name: true } } },
  });
}

/** 設定的修改紀錄（期初數字、換營收負責人）。 */
export function settingHistory(classroomId: number) {
  return prisma.financeSettingRevision.findMany({
    where: { classroomId },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, before: true, after: true, createdAt: true, editedBy: { select: { id: true, name: true } } },
  });
}
