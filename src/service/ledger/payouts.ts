// 付款批次與資金帳戶轉帳（docs/finance-v2/05 §3.8、02 §3.7）。金額單位「分」。
// 建批次：截至某天，每個對象在每個分部「可發」的應付各一筆付款（等待付款），
// 加上把分部往來轉平的轉帳建議。付款人按「已付款」才過帳。
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { roundPayout, settleInterbranch } from "@/domains/ledger/post/settle";
import type { PayableKey } from "@/domains/ledger/post/types";
import { syncLedger } from "./sync";
import { assertSettleOrHolder, assertWritableDate, dbDate, findMoneyAccount, ledgerDates, membershipOf, todayKey, ymd } from "./guard";
import { dateKeyOfDbDate } from "./load";
import { partyNames } from "./reports";

const PAYABLE_KEYS: PayableKey[] = ["TEACHER_PAYABLE", "VENUE_PAYABLE", "OWNER_PAYABLE"];

async function assertCanSettle(userId: number, classroomId: number) {
  if (!(await membershipOf(userId, classroomId)).canSettle) throw new ApiError(403, "NOT_FINANCE", "Only members who can settle can do this");
}

type Owed = { payableKey: PayableKey; partyType: "TEACHER" | "VENUE" | "USER"; partyId: number; locationId: number; amount: number };

/** 截至 asOf 的可發應付（已付的付款不管日期都扣掉，避免同一天重建批次重複付），再扣掉還沒付的付款。 */
async function owedAsOf(classroomId: number, asOf: string): Promise<Owed[]> {
  const rows = await prisma.$queryRaw<{ key: string; partyType: string; partyId: number; locationId: number; amount: bigint }[]>`
    SELECT a."systemKey" AS key, l."partyType", l."partyId", l."locationId", SUM(l."amount") AS amount
    FROM "JournalLine" l
    JOIN "LedgerAccount" a ON a."id" = l."accountId"
    JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE l."classroomId" = ${classroomId}
      AND a."systemKey" IN ('TEACHER_PAYABLE', 'VENUE_PAYABLE', 'OWNER_PAYABLE')
      AND l."partyType" IS NOT NULL
      AND (l."date" <= ${dbDate(asOf)} OR e."sourceType" = 'PAYOUT')
    GROUP BY a."systemKey", l."partyType", l."partyId", l."locationId"`;
  const pending = await prisma.payout.findMany({ where: { classroomId, status: "PENDING", voidedAt: null } });
  const k = (key: string, t: string, id: number, loc: number) => `${key}|${t}|${id}|${loc}`;
  const pend = new Map<string, number>();
  for (const p of pending) pend.set(k(p.payableKey, p.partyType, p.partyId, p.locationId), (pend.get(k(p.payableKey, p.partyType, p.partyId, p.locationId)) ?? 0) + p.amount);
  return rows
    .map((r) => ({
      payableKey: r.key as PayableKey,
      partyType: r.partyType as Owed["partyType"],
      partyId: r.partyId,
      locationId: r.locationId,
      amount: -Number(r.amount) - (pend.get(k(r.key, r.partyType, r.partyId, r.locationId)) ?? 0),
    }))
    .filter((o) => o.amount > 0 && PAYABLE_KEYS.includes(o.payableKey))
    .sort((a, b) => a.partyType.localeCompare(b.partyType) || a.partyId - b.partyId || a.locationId - b.locationId);
}

/** 誰付：收錢的人自己有資金帳戶 → 自己領；否則老師的付款人；否則應付所在分部的負責人。 */
async function payerResolver(classroomId: number) {
  const [accounts, teachers, venues, locations] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, holderUserId: true, locationId: true },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    }),
    prisma.teacher.findMany({ where: { classroomId }, select: { id: true, userId: true, payerUserId: true } }),
    prisma.venue.findMany({ where: { classroomId }, select: { id: true, landlordUserId: true } }),
    prisma.location.findMany({ where: { classroomId }, select: { id: true, keeperUserId: true } }),
  ]);
  const ofUser = (u: number | null | undefined) => (u == null ? undefined : accounts.find((a) => a.holderUserId === u));
  const keeper = new Map(locations.map((l) => [l.id, l.keeperUserId]));
  const ofLocation = (loc: number) =>
    accounts.find((a) => a.locationId === loc && a.holderUserId === keeper.get(loc)) ?? accounts.find((a) => a.locationId === loc);
  const teacher = new Map(teachers.map((t) => [t.id, t]));
  const venue = new Map(venues.map((v) => [v.id, v]));
  return {
    ofLocation,
    accountOf: (o: Pick<Owed, "partyType" | "partyId" | "locationId">) => {
      const self =
        o.partyType === "TEACHER" ? teacher.get(o.partyId)?.userId : o.partyType === "VENUE" ? venue.get(o.partyId)?.landlordUserId : o.partyId;
      const payer = o.partyType === "TEACHER" ? teacher.get(o.partyId)?.payerUserId : null;
      return (ofUser(self) ?? ofUser(payer) ?? ofLocation(o.locationId))?.id ?? null;
    },
    locationOf: (id: number) => accounts.find((a) => a.id === id)?.locationId,
  };
}

/** 分部往來：帳上餘額＋還沒付的付款與轉帳過帳後的影響。正＝別的分部欠它。 */
async function projectedInterbranch(classroomId: number): Promise<Map<number, number>> {
  const rows = await prisma.$queryRaw<{ locationId: number; amount: bigint }[]>`
    SELECT l."locationId", SUM(l."amount") AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a."id" = l."accountId"
    WHERE l."classroomId" = ${classroomId} AND a."systemKey" = 'INTERBRANCH' GROUP BY l."locationId"`;
  const ib = new Map(rows.map((r) => [r.locationId, Number(r.amount)]));
  const add = (loc: number, v: number) => ib.set(loc, (ib.get(loc) ?? 0) + v);
  const maLoc = new Map(
    (await prisma.moneyAccount.findMany({ where: { classroomId }, select: { id: true, locationId: true } })).map((m) => [m.id, m.locationId]),
  );
  for (const p of await prisma.payout.findMany({ where: { classroomId, status: "PENDING", voidedAt: null } })) {
    const m = p.fromMoneyAccountId !== null ? maLoc.get(p.fromMoneyAccountId) : undefined;
    if (m === undefined || m === p.locationId) continue;
    add(p.locationId, -p.amount);
    add(m, p.amount);
  }
  for (const t of await prisma.moneyTransfer.findMany({ where: { classroomId, status: "PENDING", voidedAt: null } })) {
    const f = maLoc.get(t.fromMoneyAccountId);
    const to = maLoc.get(t.toMoneyAccountId);
    if (f === undefined || to === undefined || f === to) continue;
    const v = t.settleAmount ?? t.amount;
    add(to, -v);
    add(f, v);
  }
  return ib;
}

export const createRunSchema = z.object({ asOf: ymd.optional(), note: z.string().trim().max(200).optional() });

export async function createPayoutRun(classroomId: number, userId: number, body: z.infer<typeof createRunSchema>) {
  await assertCanSettle(userId, classroomId);
  const { roundTo } = await ledgerDates(classroomId);
  const asOf = body.asOf ?? todayKey();
  await syncLedger(classroomId);
  const owed = await owedAsOf(classroomId, asOf);
  const payer = await payerResolver(classroomId);

  const run = await prisma.payoutRun.create({ data: { classroomId, asOf: dbDate(asOf), note: body.note ?? null, createdById: userId } });
  if (owed.length > 0) {
    await prisma.payout.createMany({
      data: owed.map((o) => ({
        classroomId,
        runId: run.id,
        ...o,
        paidAmount: roundPayout(o.amount, roundTo),
        fromMoneyAccountId: payer.accountOf(o),
        createdById: userId,
      })),
    });
  }
  // 付完這些之後的分部往來 → 轉平建議（每對分部一筆，從負責人的帳戶轉給對方負責人的帳戶）。
  const warnings: string[] = [];
  for (const s of settleInterbranch(await projectedInterbranch(classroomId))) {
    const from = payer.ofLocation(s.fromLocationId);
    const to = payer.ofLocation(s.toLocationId);
    if (!from || !to) {
      warnings.push(`NO_MONEY_ACCOUNT_FOR_LOCATION ${!from ? s.fromLocationId : s.toLocationId}`);
      continue;
    }
    await prisma.moneyTransfer.create({
      data: {
        classroomId,
        runId: run.id,
        fromMoneyAccountId: from.id,
        toMoneyAccountId: to.id,
        amount: roundPayout(s.amount, roundTo),
        settleAmount: s.amount,
        status: "PENDING",
        note: "分部往來轉平",
        createdById: userId,
      },
    });
  }
  return { ...(await getPayoutRun(classroomId, run.id)), warnings };
}

export async function getPayoutRun(classroomId: number, runId: number) {
  const run = await prisma.payoutRun.findFirst({
    where: { id: runId, classroomId },
    include: { payouts: { orderBy: { id: "asc" } }, transfers: { orderBy: { id: "asc" } } },
  });
  if (!run) throw new ApiError(404, "NOT_FOUND", "Payout run not found");
  const nameOf = await partyNames(classroomId, run.payouts);
  return {
    id: run.id,
    asOf: dateKeyOfDbDate(run.asOf),
    note: run.note,
    createdAt: run.createdAt,
    payouts: run.payouts.map((p) => ({ ...payoutView(p), name: nameOf(p.partyType, p.partyId) })),
    transfers: run.transfers.map(transferView),
  };
}

export async function listPayoutRuns(classroomId: number) {
  const runs = await prisma.payoutRun.findMany({ where: { classroomId }, orderBy: { id: "desc" }, take: 24, select: { id: true } });
  return { runs: await Promise.all(runs.map((r) => getPayoutRun(classroomId, r.id))) };
}

type PayoutRow = Awaited<ReturnType<typeof prisma.payout.findFirstOrThrow>>;
function payoutView(p: PayoutRow) {
  return {
    id: p.id,
    runId: p.runId,
    partyType: p.partyType,
    partyId: p.partyId,
    payableKey: p.payableKey,
    locationId: p.locationId,
    amount: p.amount,
    paidAmount: p.paidAmount,
    fromMoneyAccountId: p.fromMoneyAccountId,
    status: p.voidedAt ? ("VOIDED" as const) : p.status,
    paidDate: p.paidDate ? dateKeyOfDbDate(p.paidDate) : null,
  };
}
type TransferRow = Awaited<ReturnType<typeof prisma.moneyTransfer.findFirstOrThrow>>;
function transferView(t: TransferRow) {
  return {
    id: t.id,
    runId: t.runId,
    fromMoneyAccountId: t.fromMoneyAccountId,
    toMoneyAccountId: t.toMoneyAccountId,
    amount: t.amount,
    settleAmount: t.settleAmount,
    status: t.voidedAt ? ("VOIDED" as const) : t.status,
    date: t.date ? dateKeyOfDbDate(t.date) : null,
    note: t.note,
  };
}

async function findPayout(classroomId: number, id: number) {
  const p = await prisma.payout.findFirst({ where: { id, classroomId } });
  if (!p) throw new ApiError(404, "NOT_FOUND", "Payout not found");
  return p;
}

export const updatePayoutSchema = z.object({
  fromMoneyAccountId: z.number().int().positive().optional(),
  paidAmount: z.number().int().min(0).optional(),
});

/** 還沒付的付款：改付款帳戶或實付金額（尾差跟著變）。 */
export async function updatePayout(classroomId: number, userId: number, id: number, body: z.infer<typeof updatePayoutSchema>) {
  await assertCanSettle(userId, classroomId);
  const p = await findPayout(classroomId, id);
  if (p.status !== "PENDING" || p.voidedAt) throw new ApiError(409, "PAYOUT_NOT_PENDING", "Only pending payouts can be changed");
  if (body.fromMoneyAccountId !== undefined) await findMoneyAccount(classroomId, body.fromMoneyAccountId);
  const updated = await prisma.payout.update({ where: { id }, data: body });
  return payoutView(updated);
}

export const markPaidSchema = z.object({ date: ymd.optional(), fromMoneyAccountId: z.number().int().positive().optional() });

/** 付款人按「已付款」：寫入付款分錄。 */
export async function markPayoutPaid(classroomId: number, userId: number, id: number, body: z.infer<typeof markPaidSchema>) {
  const p = await findPayout(classroomId, id);
  if (p.status !== "PENDING" || p.voidedAt) throw new ApiError(409, "PAYOUT_NOT_PENDING", "This payout is not pending");
  const from = body.fromMoneyAccountId ?? p.fromMoneyAccountId;
  if (from === null) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "Choose which money account paid");
  const ma = await findMoneyAccount(classroomId, from);
  if (ma.archivedAt) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "This money account is archived");
  await assertSettleOrHolder(userId, classroomId, from);
  const date = body.date ?? todayKey();
  await assertWritableDate(classroomId, date);
  const updated = await prisma.payout.updateMany({
    where: { id, status: "PENDING", voidedAt: null },
    data: { status: "PAID", paidDate: dbDate(date), paidById: userId, fromMoneyAccountId: from },
  });
  if (updated.count === 0) throw new ApiError(409, "PAYOUT_NOT_PENDING", "This payout is not pending");
  await syncLedger(classroomId);
  return payoutView(await findPayout(classroomId, id));
}

/** 刪除：還沒付的直接刪；已付的作廢（帳本記一筆更正，鎖帳期間的落在鎖帳日隔天）。 */
export async function deletePayout(classroomId: number, userId: number, id: number) {
  await assertCanSettle(userId, classroomId);
  const p = await findPayout(classroomId, id);
  if (p.voidedAt) return { ok: true };
  if (p.status === "PENDING") await prisma.payout.delete({ where: { id } });
  else {
    await prisma.payout.update({ where: { id }, data: { voidedAt: new Date() } });
    await syncLedger(classroomId);
  }
  return { ok: true };
}

// ── 轉帳

export const transferSchema = z
  .object({
    fromMoneyAccountId: z.number().int().positive(),
    toMoneyAccountId: z.number().int().positive(),
    amount: z.number().int().positive(),
    date: ymd.optional(),
    pending: z.boolean().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((b) => b.fromMoneyAccountId !== b.toMoneyAccountId, { message: "from and to must differ" });

export async function createMoneyTransfer(classroomId: number, userId: number, body: z.infer<typeof transferSchema>) {
  const from = await findMoneyAccount(classroomId, body.fromMoneyAccountId);
  const to = await findMoneyAccount(classroomId, body.toMoneyAccountId);
  if (from.archivedAt || to.archivedAt) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "This money account is archived");
  await assertSettleOrHolder(userId, classroomId, from.id);
  const date = body.pending ? null : (body.date ?? todayKey());
  if (date) await assertWritableDate(classroomId, date);
  const t = await prisma.moneyTransfer.create({
    data: {
      classroomId,
      fromMoneyAccountId: from.id,
      toMoneyAccountId: to.id,
      amount: body.amount,
      status: date ? "PAID" : "PENDING",
      date: date ? dbDate(date) : null,
      doneById: date ? userId : null,
      note: body.note ?? null,
      createdById: userId,
    },
  });
  if (date) await syncLedger(classroomId);
  return transferView(t);
}

async function findTransfer(classroomId: number, id: number) {
  const t = await prisma.moneyTransfer.findFirst({ where: { id, classroomId } });
  if (!t) throw new ApiError(404, "NOT_FOUND", "Transfer not found");
  return t;
}

export async function markTransferDone(classroomId: number, userId: number, id: number, body: { date?: string }) {
  const t = await findTransfer(classroomId, id);
  if (t.status !== "PENDING" || t.voidedAt) throw new ApiError(409, "TRANSFER_NOT_PENDING", "This transfer is not pending");
  await assertSettleOrHolder(userId, classroomId, t.fromMoneyAccountId);
  const date = body.date ?? todayKey();
  await assertWritableDate(classroomId, date);
  await prisma.moneyTransfer.update({ where: { id }, data: { status: "PAID", date: dbDate(date), doneById: userId } });
  await syncLedger(classroomId);
  return transferView(await findTransfer(classroomId, id));
}

export async function deleteMoneyTransfer(classroomId: number, userId: number, id: number) {
  const t = await findTransfer(classroomId, id);
  await assertSettleOrHolder(userId, classroomId, t.fromMoneyAccountId);
  if (t.voidedAt) return { ok: true };
  if (t.status === "PENDING") await prisma.moneyTransfer.delete({ where: { id } });
  else {
    await prisma.moneyTransfer.update({ where: { id }, data: { voidedAt: new Date() } });
    await syncLedger(classroomId);
  }
  return { ok: true };
}
