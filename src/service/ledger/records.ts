// 記一筆（docs/finance-v2/05 §3.7）：業主交易、盤點、手動分錄與沖銷。金額單位「分」。
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { balanceByBranch, type DesiredLine, type Party } from "@/domains/ledger/lines";
import { syncLedger } from "./sync";
import { assertSettleOrHolder, assertWritableDate, dbDate, findMoneyAccount, membershipOf, todayKey, ymd } from "./guard";
import { dateKeyOfDbDate } from "./load";

async function assertCanSettle(userId: number, classroomId: number) {
  if (!(await membershipOf(userId, classroomId)).canSettle) throw new ApiError(403, "NOT_FINANCE", "Only members who can settle can do this");
}

// ── 業主投入／提取／宣告分紅

export const ownerTxnSchema = z
  .object({
    kind: z.enum(["CONTRIBUTION", "DRAWING", "DIVIDEND"]),
    userId: z.number().int().positive(),
    amount: z.number().int().positive(),
    date: ymd.optional(),
    moneyAccountId: z.number().int().positive().optional(),
    locationId: z.number().int().positive().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((b) => (b.kind === "DIVIDEND" ? b.locationId !== undefined : b.moneyAccountId !== undefined), {
    message: "DIVIDEND needs locationId; CONTRIBUTION/DRAWING need moneyAccountId",
  });

export async function createOwnerTxn(classroomId: number, userId: number, body: z.infer<typeof ownerTxnSchema>) {
  await assertCanSettle(userId, classroomId);
  const member = await prisma.membership.findUnique({ where: { userId_classroomId: { userId: body.userId, classroomId } } });
  if (!member) throw new ApiError(400, "INVALID_USER", "Not a member of this classroom");
  if (body.moneyAccountId !== undefined) {
    const ma = await findMoneyAccount(classroomId, body.moneyAccountId);
    if (ma.archivedAt) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "This money account is archived");
  }
  if (body.kind === "DIVIDEND") {
    const loc = await prisma.location.findFirst({ where: { id: body.locationId, classroomId } });
    if (!loc) throw new ApiError(400, "INVALID_LOCATION", "Location not found");
  }
  const date = body.date ?? todayKey();
  await assertWritableDate(classroomId, date);
  const o = await prisma.ownerTransaction.create({
    data: {
      classroomId,
      kind: body.kind,
      userId: body.userId,
      amount: body.amount,
      date: dbDate(date),
      moneyAccountId: body.kind === "DIVIDEND" ? null : body.moneyAccountId!,
      locationId: body.kind === "DIVIDEND" ? body.locationId! : null,
      note: body.note ?? null,
      createdById: userId,
    },
  });
  await syncLedger(classroomId);
  return { ...o, date: dateKeyOfDbDate(o.date) };
}

export async function voidOwnerTxn(classroomId: number, userId: number, id: number) {
  await assertCanSettle(userId, classroomId);
  const o = await prisma.ownerTransaction.findFirst({ where: { id, classroomId } });
  if (!o) throw new ApiError(404, "NOT_FOUND", "Not found");
  if (!o.voidedAt) {
    await prisma.ownerTransaction.update({ where: { id }, data: { voidedAt: new Date() } });
    await syncLedger(classroomId);
  }
  return { ok: true };
}

// ── 現金盤點

/** 資金帳戶在某天（含）的帳上餘額。 */
export async function moneyAccountBalance(classroomId: number, accountId: number, asOf: string): Promise<number> {
  const r = await prisma.journalLine.aggregate({
    where: { classroomId, accountId, date: { lte: dbDate(asOf) } },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export const cashCountSchema = z.object({
  moneyAccountId: z.number().int().positive(),
  counted: z.number().int(),
  date: ymd.optional(),
  note: z.string().trim().max(200).optional(),
});

export async function createCashCount(classroomId: number, userId: number, body: z.infer<typeof cashCountSchema>) {
  const ma = await findMoneyAccount(classroomId, body.moneyAccountId);
  await assertSettleOrHolder(userId, classroomId, ma.id);
  const date = body.date ?? todayKey();
  await assertWritableDate(classroomId, date);
  await syncLedger(classroomId);
  const systemBalance = await moneyAccountBalance(classroomId, ma.accountId, date);
  const c = await prisma.cashCount.create({
    data: { classroomId, moneyAccountId: ma.id, date: dbDate(date), systemBalance, counted: body.counted, note: body.note ?? null, createdById: userId },
  });
  await syncLedger(classroomId);
  return { id: c.id, moneyAccountId: ma.id, date, systemBalance, counted: c.counted, difference: c.counted - systemBalance };
}

export async function listMoneyAccounts(classroomId: number) {
  await syncLedger(classroomId);
  const today = todayKey();
  const [accounts, counts] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { classroomId },
      select: { id: true, name: true, kind: true, holderUserId: true, locationId: true, isDefault: true, archivedAt: true, accountId: true, account: { select: { code: true } } },
      orderBy: [{ holderUserId: "asc" }, { id: "asc" }],
    }),
    prisma.cashCount.findMany({ where: { classroomId, voidedAt: null }, orderBy: [{ date: "desc" }, { id: "desc" }] }),
  ]);
  const balances = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { classroomId, accountId: { in: accounts.map((a) => a.accountId) } },
    _sum: { amount: true },
  });
  const bal = new Map(balances.map((b) => [b.accountId, b._sum.amount ?? 0]));
  return {
    today,
    accounts: accounts.map(({ account, accountId, ...a }) => {
      const last = counts.find((c) => c.moneyAccountId === a.id);
      return {
        ...a,
        code: account.code,
        balance: bal.get(accountId) ?? 0,
        lastCount: last ? { id: last.id, date: dateKeyOfDbDate(last.date), difference: last.counted - last.systemBalance } : null,
      };
    }),
  };
}

export async function voidCashCount(classroomId: number, userId: number, id: number) {
  const c = await prisma.cashCount.findFirst({ where: { id, classroomId } });
  if (!c) throw new ApiError(404, "NOT_FOUND", "Not found");
  await assertSettleOrHolder(userId, classroomId, c.moneyAccountId);
  if (!c.voidedAt) {
    await prisma.cashCount.update({ where: { id }, data: { voidedAt: new Date() } });
    await syncLedger(classroomId);
  }
  return { ok: true };
}

// ── 手動分錄與沖銷

const PARTY_TYPES = ["STUDENT_CARD", "DROP_IN", "TEACHER", "VENUE", "USER", "STUDENT"] as const;

export const journalSchema = z.object({
  date: ymd,
  memo: z.string().trim().min(1).max(200),
  lines: z
    .array(
      z.object({
        accountId: z.number().int().positive(),
        locationId: z.number().int().positive(),
        amount: z.number().int().refine((n) => n !== 0, "amount must not be 0"), // 分；正＝借、負＝貸
        partyType: z.enum(PARTY_TYPES).optional(),
        partyId: z.number().int().positive().optional(),
        memo: z.string().trim().max(200).optional(),
      }),
    )
    .min(2)
    .max(50),
});

type JournalLineInput = { date: string; accountId: number; locationId: number; amount: number; partyType: string | null; partyId: number | null; memo: string | null };

async function writeEntry(
  classroomId: number,
  userId: number,
  data: { date: string; kind: "MANUAL" | "REVERSAL"; memo: string; reversesId?: number },
  lines: JournalLineInput[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7001, ${classroomId}::int)::text AS ok`;
    return tx.journalEntry.create({
      data: {
        classroomId,
        date: dbDate(data.date),
        kind: data.kind,
        memo: data.memo,
        reversesId: data.reversesId ?? null,
        createdById: userId,
        lines: {
          createMany: {
            data: lines.map((l) => ({ classroomId, ...l, date: dbDate(l.date) })),
          },
        },
      },
      select: { id: true },
    });
  });
}

/** 手動分錄：借貸合計要平；跨分部自動補分部往來。不能記在現金總科目（要記在某個資金帳戶）。 */
export async function createManualEntry(classroomId: number, userId: number, body: z.infer<typeof journalSchema>) {
  await assertCanSettle(userId, classroomId);
  await assertWritableDate(classroomId, body.date);
  const total = body.lines.reduce((s, l) => s + l.amount, 0);
  if (total !== 0) throw new ApiError(400, "UNBALANCED", `Debits and credits differ by ${total}`);
  const [accounts, locations] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { classroomId, id: { in: body.lines.map((l) => l.accountId) } }, select: { id: true, systemKey: true, archivedAt: true } }),
    prisma.location.findMany({ where: { classroomId, id: { in: body.lines.map((l) => l.locationId) } }, select: { id: true } }),
  ]);
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const locs = new Set(locations.map((l) => l.id));
  const cashLoc = new Map(
    (await prisma.moneyAccount.findMany({ where: { classroomId, accountId: { in: accounts.map((a) => a.id) } }, select: { accountId: true, locationId: true } })).map(
      (m) => [m.accountId, m.locationId],
    ),
  );
  for (const l of body.lines) {
    const a = acc.get(l.accountId);
    if (!a || a.archivedAt) throw new ApiError(400, "INVALID_ACCOUNT", `Account ${l.accountId} not found`);
    if (a.systemKey === "CASH" || a.systemKey === "INTERBRANCH") {
      throw new ApiError(400, "INVALID_ACCOUNT", "Post to a money account, not the cash parent; interbranch lines are added automatically");
    }
    if (!locs.has(l.locationId)) throw new ApiError(400, "INVALID_LOCATION", `Location ${l.locationId} not found`);
    const ml = cashLoc.get(l.accountId);
    if (ml !== undefined && ml !== l.locationId) throw new ApiError(400, "INVALID_LOCATION", "A money account's lines belong to its own branch");
    if ((l.partyType === undefined) !== (l.partyId === undefined)) throw new ApiError(400, "INVALID_PARTY", "partyType and partyId go together");
  }
  const ibId = (await prisma.ledgerAccount.findFirstOrThrow({ where: { classroomId, systemKey: "INTERBRANCH" }, select: { id: true } })).id;
  const desired: DesiredLine[] = body.lines.map((l) => ({
    date: body.date,
    account: { accountId: l.accountId },
    locationId: l.locationId,
    amount: l.amount,
    ...(l.partyType ? { party: { type: l.partyType, id: l.partyId! } as Party } : {}),
    ...(l.memo ? { memo: l.memo } : {}),
  }));
  const lines = balanceByBranch(desired).map((l) => ({
    date: l.date,
    accountId: "accountId" in l.account ? l.account.accountId : ibId, // balanceByBranch 補的是 { key: INTERBRANCH }
    locationId: l.locationId,
    amount: l.amount,
    partyType: l.party?.type ?? null,
    partyId: l.party?.id ?? null,
    memo: l.memo ?? null,
  }));
  const e = await writeEntry(classroomId, userId, { date: body.date, kind: "MANUAL", memo: body.memo }, lines);
  return getEntry(classroomId, e.id);
}

export const reverseSchema = z.object({ date: ymd.optional(), memo: z.string().trim().max(200).optional() });

/** 沖銷手動分錄：記一筆完全相反的分錄（不能刪改）。系統過帳的分錄要改來源（作廢那筆付款／支出…）。 */
export async function reverseEntry(classroomId: number, userId: number, id: number, body: z.infer<typeof reverseSchema>) {
  await assertCanSettle(userId, classroomId);
  const e = await prisma.journalEntry.findFirst({ where: { id, classroomId }, include: { lines: true } });
  if (!e) throw new ApiError(404, "NOT_FOUND", "Entry not found");
  if (e.kind !== "MANUAL") throw new ApiError(409, "NOT_REVERSIBLE", "Only manual entries can be reversed; change the source record instead");
  if (await prisma.journalEntry.findFirst({ where: { classroomId, reversesId: id } })) {
    throw new ApiError(409, "ALREADY_REVERSED", "This entry has already been reversed");
  }
  const date = body.date ?? todayKey();
  await assertWritableDate(classroomId, date);
  const r = await writeEntry(
    classroomId,
    userId,
    { date, kind: "REVERSAL", memo: body.memo ?? `沖銷：${e.memo ?? `#${e.id}`}`, reversesId: e.id },
    e.lines.map((l) => ({ date, accountId: l.accountId, locationId: l.locationId, amount: -l.amount, partyType: l.partyType, partyId: l.partyId, memo: l.memo })),
  );
  return getEntry(classroomId, r.id);
}

export async function getEntry(classroomId: number, id: number) {
  const e = await prisma.journalEntry.findFirst({
    where: { id, classroomId },
    include: { lines: { orderBy: { id: "asc" }, include: { account: { select: { code: true, name: true } } } } },
  });
  if (!e) throw new ApiError(404, "NOT_FOUND", "Entry not found");
  const reversedBy = await prisma.journalEntry.findFirst({ where: { classroomId, reversesId: id }, select: { id: true } });
  return {
    id: e.id,
    date: dateKeyOfDbDate(e.date),
    kind: e.kind,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    memo: e.memo,
    reversesId: e.reversesId,
    reversedById: reversedBy?.id ?? null,
    createdById: e.createdById,
    lines: e.lines.map((l) => ({
      accountId: l.accountId,
      code: l.account.code,
      accountName: l.account.name,
      locationId: l.locationId,
      amount: l.amount,
      partyType: l.partyType,
      partyId: l.partyId,
      memo: l.memo,
    })),
  };
}

/** 人記的分錄（手動、沖銷、期初）清單。 */
export async function listManualEntries(classroomId: number) {
  const entries = await prisma.journalEntry.findMany({
    where: { classroomId, kind: { in: ["MANUAL", "REVERSAL", "OPENING"] } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 100,
    select: { id: true },
  });
  return { entries: await Promise.all(entries.map((e) => getEntry(classroomId, e.id))) };
}
