// 結帳（docs/finance-v2/05 §3.10、03 §3.5）：結帳清單、分部簽核、鎖帳／解鎖與紀錄。
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { syncLedger } from "./sync";
import { checkLedger } from "./check";
import { loadLedgerInputs, dateKeyOfDbDate } from "./load";
import { dbDate, ledgerDates, membershipOf, todayKey, ymd } from "./guard";

export const lockSchema = z.object({ lockDate: ymd.nullable(), note: z.string().trim().max(200).optional() });

/**
 * 設定鎖帳日：往後推＝可以結算的人；往前或解鎖＝owner。要先開帳。
 * 鎖之前先過帳一次，讓鎖住的日子裡該有的分錄都已經記好。
 */
export async function setLockDate(classroomId: number, userId: number, body: z.infer<typeof lockSchema>) {
  const d = await ledgerDates(classroomId);
  if (!d.opened) throw new ApiError(409, "LEDGER_NOT_OPENED", "Open the ledger before locking it");
  const m = await membershipOf(userId, classroomId);
  const forward = body.lockDate !== null && (d.lockDate === null || body.lockDate > d.lockDate);
  if (body.lockDate === d.lockDate) return getLockState(classroomId);
  if (forward) {
    if (!m.canSettle) throw new ApiError(403, "NOT_FINANCE", "Only members who can settle can lock");
    if (body.lockDate! > todayKey()) throw new ApiError(400, "LOCK_IN_FUTURE", "Cannot lock a date in the future");
    if (body.lockDate! < d.conversionDate) throw new ApiError(400, "BEFORE_CONVERSION", "Cannot lock before the conversion date");
  } else if (m.role !== "owner") {
    throw new ApiError(403, "OWNER_ONLY", "Only the owner can unlock");
  }
  await syncLedger(classroomId);
  await prisma.$transaction([
    prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: body.lockDate ? dbDate(body.lockDate) : null } }),
    prisma.financeLockLog.create({
      data: {
        classroomId,
        fromDate: d.lockDate ? dbDate(d.lockDate) : null,
        toDate: body.lockDate ? dbDate(body.lockDate) : null,
        userId,
        note: body.note ?? null,
      },
    }),
  ]);
  return getLockState(classroomId);
}

export async function getLockState(classroomId: number) {
  const d = await ledgerDates(classroomId);
  const log = await prisma.financeLockLog.findMany({ where: { classroomId }, orderBy: { id: "desc" }, take: 50 });
  return {
    lockDate: d.lockDate,
    conversionDate: d.conversionDate,
    opened: d.opened,
    history: log.map((l) => ({
      id: l.id,
      fromDate: l.fromDate ? dateKeyOfDbDate(l.fromDate) : null,
      toDate: l.toDate ? dateKeyOfDbDate(l.toDate) : null,
      userId: l.userId,
      note: l.note,
      createdAt: l.createdAt,
    })),
  };
}

export const signoffSchema = z.object({ locationId: z.number().int().positive(), asOf: ymd });

/** 分部負責人（或 owner）簽核：看過到 asOf 的損益表。 */
export async function signOff(classroomId: number, userId: number, body: z.infer<typeof signoffSchema>) {
  const loc = await prisma.location.findFirst({ where: { id: body.locationId, classroomId }, select: { keeperUserId: true } });
  if (!loc) throw new ApiError(400, "INVALID_LOCATION", "Location not found");
  const m = await membershipOf(userId, classroomId);
  if (loc.keeperUserId !== userId && m.role !== "owner") throw new ApiError(403, "NOT_KEEPER", "Only this branch's keeper or the owner can sign off");
  await prisma.financeCloseSignoff.upsert({
    where: { classroomId_locationId_asOf: { classroomId, locationId: body.locationId, asOf: dbDate(body.asOf) } },
    create: { classroomId, locationId: body.locationId, asOf: dbDate(body.asOf), userId },
    update: {},
  });
  return { ok: true };
}

/** 結帳清單：鎖到 asOf 之前要確認的事。只列狀態，不強制。 */
export async function getCloseChecklist(classroomId: number, asOf: string) {
  const d = await ledgerDates(classroomId);
  await syncLedger(classroomId);
  const from = d.lockDate && d.lockDate >= d.conversionDate ? d.lockDate : null; // 這次要鎖的區間：(from, asOf]
  const end = parseTaipeiDateRange(asOf).end;
  const start = from ? parseTaipeiDateRange(from).end : parseTaipeiDateRange(d.conversionDate).start;

  const [unchecked, inputs, problems, accounts, counts, locations, signoffs, ar] = await Promise.all([
    prisma.lessonPeriod.findMany({
      where: { lesson: { classroomId }, attendanceTakenAt: null, startTime: { gte: start, lt: end } },
      select: { id: true, startTime: true, lesson: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
      take: 50,
    }),
    loadLedgerInputs(classroomId),
    checkLedger(classroomId),
    prisma.moneyAccount.findMany({ where: { classroomId, archivedAt: null }, select: { id: true, name: true, holderUserId: true } }),
    prisma.cashCount.findMany({ where: { classroomId, voidedAt: null, date: { lte: dbDate(asOf) } }, select: { moneyAccountId: true, date: true } }),
    prisma.location.findMany({ where: { classroomId, archivedAt: null }, select: { id: true, name: true, keeperUserId: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.financeCloseSignoff.findMany({ where: { classroomId, asOf: dbDate(asOf) } }),
    prisma.$queryRaw<{ partyType: string; partyId: number; amount: bigint }[]>`
      SELECT l."partyType", l."partyId", SUM(l."amount") AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a."id" = l."accountId"
      WHERE l."classroomId" = ${classroomId} AND a."systemKey" = 'AR' AND l."date" <= ${dbDate(asOf)}
      GROUP BY l."partyType", l."partyId" HAVING SUM(l."amount") <> 0`,
  ]);

  const inRange = (t: Date) => t >= start && t < end;
  const noRule = new Map<number, { lessonId: number; periods: number }>();
  const lessonOf = new Map(
    (await prisma.lessonPeriod.findMany({
      where: { id: { in: (inputs?.periods ?? []).filter((p) => p.rule === null && inRange(p.startTime)).map((p) => p.id) } },
      select: { id: true, lesson: { select: { id: true, name: true } } },
    })).map((p) => [p.id, p.lesson]),
  );
  for (const p of inputs?.periods ?? []) {
    const l = lessonOf.get(p.id);
    if (!l) continue;
    const cur = noRule.get(l.id) ?? { lessonId: l.id, periods: 0 };
    cur.periods++;
    noRule.set(l.id, cur);
  }
  const lessonNames = new Map([...lessonOf.values()].map((l) => [l.id, l.name]));
  const lastCount = (id: number) =>
    counts.filter((c) => c.moneyAccountId === id).map((c) => dateKeyOfDbDate(c.date)).sort().at(-1) ?? null;
  const uncounted = accounts.filter((a) => {
    const last = lastCount(a.id);
    return last === null || (from !== null && last <= from);
  });
  const signed = new Set(signoffs.map((s) => s.locationId));

  const items = [
    { key: "ATTENDANCE", done: unchecked.length === 0, count: unchecked.length,
      details: unchecked.map((p) => ({ periodId: p.id, lessonId: p.lesson.id, lessonName: p.lesson.name, startTime: p.startTime })) },
    { key: "RECEIVABLES", done: ar.length === 0, count: ar.length, total: ar.reduce((s, r) => s + Number(r.amount), 0),
      details: ar.map((r) => ({ partyType: r.partyType, partyId: r.partyId, amount: Number(r.amount) })) },
    { key: "SPLIT_RULES", done: noRule.size === 0, count: noRule.size,
      details: [...noRule.values()].map((x) => ({ ...x, lessonName: lessonNames.get(x.lessonId) ?? "" })) },
    { key: "LEDGER_HEALTH", done: problems.length === 0, count: problems.length, details: problems.slice(0, 50) },
    { key: "CASH_COUNTS", done: uncounted.length === 0, count: uncounted.length, optional: true,
      details: uncounted.map((a) => ({ moneyAccountId: a.id, name: a.name, lastCount: lastCount(a.id) })) },
    { key: "SIGNOFFS", done: locations.every((l) => signed.has(l.id)), count: locations.filter((l) => !signed.has(l.id)).length,
      details: locations.map((l) => ({ locationId: l.id, name: l.name, keeperUserId: l.keeperUserId, signed: signed.has(l.id) })) },
  ];
  return { asOf, lockDate: d.lockDate, conversionDate: d.conversionDate, opened: d.opened, ready: items.every((i) => i.done || i.optional), items };
}
