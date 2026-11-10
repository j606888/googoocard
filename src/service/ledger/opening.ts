// 開帳精靈（docs/finance-v2/04-opening-and-cutover.md）：預覽、開帳、重開。
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/authz";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { computeOpening, type OpeningError } from "@/domains/ledger/opening";
import { toCents } from "@/domains/ledger/money";
import type { AccountRef, SystemAccountKey } from "@/domains/ledger/accounts";
import type { DesiredLine } from "@/domains/ledger/lines";
import { loadLedgerInputs, dateKeyOfDbDate } from "./load";
import { syncLedger } from "./sync";
import { setLegacyCardExpiry } from "@/service/finance/setup";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const openingParamsSchema = z.object({
  conversionDate: ymd,
  method: z.enum(["CONVENTION", "ACTUAL"]),
  cash: z.array(z.object({ moneyAccountId: z.number().int(), amount: z.number() })).default([]),
  payables: z
    .array(
      z.object({
        kind: z.enum(["TEACHER", "VENUE", "OWNER"]),
        partyId: z.number().int(),
        locationId: z.number().int(),
        amount: z.number(),
      }),
    )
    .default([]),
});
export type OpeningParams = z.infer<typeof openingParamsSchema>;

/** 期初資產負債表的一列（分）。 */
export type OpeningRow = { locationId: number; group: "ASSET" | "LIABILITY" | "EQUITY"; label: string; amount: number };

export type OpeningPreview = {
  conversionDate: string;
  method: OpeningParams["method"];
  rows: OpeningRow[];
  /** 每個分部：資產＝負債＋權益 的檢查（分）。 */
  totals: { locationId: number; assets: number; liabilities: number; equity: number }[];
  legacyCards: { count: number; deferred: number; receivable: number };
  errors: OpeningError[];
  /** 給寫入用：已換成 accountId 的期初分錄行。 */
  lines: DesiredLine[];
};

const LABEL: Partial<Record<SystemAccountKey, string>> = {
  AR: "應收學費",
  PREPAID_VENUE: "預付場地費",
  INTERBRANCH: "分部往來",
  DEFERRED_REVENUE: "預收學費",
  TEACHER_PAYABLE: "應付老師報酬",
  VENUE_PAYABLE: "應付場地費",
  OWNER_PAYABLE: "應付業主款",
  OPENING_EQUITY: "公積金（期初）",
};
const GROUP: Partial<Record<SystemAccountKey, OpeningRow["group"]>> = {
  AR: "ASSET",
  PREPAID_VENUE: "ASSET",
  DEFERRED_REVENUE: "LIABILITY",
  TEACHER_PAYABLE: "LIABILITY",
  VENUE_PAYABLE: "LIABILITY",
  OWNER_PAYABLE: "LIABILITY",
  OPENING_EQUITY: "EQUITY",
};

/** 轉換日前買、還沒用掉的次數包＝轉換日當天還剩的（04 §3 步驟 4；次數包從轉換日起扣）。 */
async function prepaidVenuesAt(classroomId: number, conversionDate: string, moneyAccountLoc: (userId: number) => number | null) {
  const start = parseTaipeiDateRange(conversionDate).start;
  const packs = await prisma.venuePack.findMany({
    where: { classroomId, voidedAt: null, purchasedAt: { lt: start } },
    select: { venueId: true, price: true, paidByUserId: true, venue: { select: { locationId: true } } },
  });
  const out: { venueId: number; locationId: number; amount: number }[] = [];
  const errors: OpeningError[] = [];
  for (const p of packs) {
    // 預付場地費記在場地的分部；舊資料場地沒分部 → 付款人帳戶的分部。
    const loc = p.venue.locationId ?? moneyAccountLoc(p.paidByUserId);
    if (loc === null) {
      errors.push({ code: "NO_MONEY_ACCOUNT", detail: `venue pack paid by user ${p.paidByUserId}`, userId: p.paidByUserId });
      continue;
    }
    out.push({ venueId: p.venueId, locationId: loc, amount: toCents(p.price) });
  }
  return { out, errors };
}

export async function previewOpening(classroomId: number, params: OpeningParams): Promise<OpeningPreview> {
  const inputs = await loadLedgerInputs(classroomId, { conversionDate: params.conversionDate });
  if (!inputs) throw new ApiError(404, "FINANCE_NOT_ENABLED", "Finance is not enabled");
  const { ctx } = inputs;

  const maLoc = new Map(
    (await prisma.moneyAccount.findMany({ where: { classroomId, archivedAt: null }, select: { id: true, locationId: true } })).map(
      (m) => [m.id, m.locationId],
    ),
  );
  const prepaid = await prepaidVenuesAt(classroomId, params.conversionDate, (u) => ctx.moneyAccountOf(u)?.locationId ?? null);

  const result = computeOpening({
    conversionDate: params.conversionDate,
    method: params.method,
    cards: inputs.cards,
    ctx,
    cash: params.cash,
    prepaidVenues: prepaid.out,
    payables: params.payables,
    moneyAccountLocation: (id) => maLoc.get(id) ?? null,
  });

  // 期初資產負債表（依分部、依科目／資金帳戶）
  const maName = new Map(
    (await prisma.moneyAccount.findMany({ where: { classroomId }, select: { id: true, name: true } })).map((m) => [m.id, m.name]),
  );
  const rowMap = new Map<string, OpeningRow>();
  for (const l of result.lines) {
    let label: string;
    let group: OpeningRow["group"];
    let sign = 1;
    if ("moneyAccountId" in l.account) {
      label = maName.get(l.account.moneyAccountId) ?? "資金帳戶";
      group = "ASSET";
    } else if ("key" in l.account) {
      const key = l.account.key;
      label = LABEL[key] ?? key;
      group = key === "INTERBRANCH" ? (l.amount >= 0 ? "ASSET" : "LIABILITY") : (GROUP[key] ?? "ASSET");
    } else continue;
    if (group !== "ASSET") sign = -1; // 負債、權益以貸方為正
    const k = `${l.locationId}|${group}|${label}`;
    const cur = rowMap.get(k) ?? { locationId: l.locationId, group, label, amount: 0 };
    cur.amount += sign * l.amount;
    rowMap.set(k, cur);
  }
  const rows = [...rowMap.values()].filter((r) => r.amount !== 0);
  const locs = [...new Set(rows.map((r) => r.locationId))].sort((a, b) => a - b);
  const totals = locs.map((locationId) => {
    const sum = (g: OpeningRow["group"]) => rows.filter((r) => r.locationId === locationId && r.group === g).reduce((s, r) => s + r.amount, 0);
    return { locationId, assets: sum("ASSET"), liabilities: sum("LIABILITY"), equity: sum("EQUITY") };
  });

  const resolve = (ref: AccountRef): AccountRef => {
    if ("accountId" in ref) return ref;
    if ("moneyAccountId" in ref) return { accountId: inputs.accountIdOfMoney.get(ref.moneyAccountId)! };
    return { accountId: inputs.accountIdOfKey[ref.key] };
  };

  return {
    conversionDate: params.conversionDate,
    method: params.method,
    rows,
    totals,
    legacyCards: {
      count: result.cards.length,
      deferred: result.cards.reduce((s, c) => s + c.deferred, 0),
      receivable: result.cards.reduce((s, c) => s + c.receivable, 0),
    },
    errors: [...result.errors, ...prepaid.errors],
    lines: result.lines.map((l) => ({ ...l, account: resolve(l.account) })),
  };
}

export async function getOpening(classroomId: number) {
  const c = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: { financeOpenedAt: true, financeOpening: true, financeConversionDate: true, financeLockDate: true, financeEnabledAt: true },
  });
  return {
    opened: c.financeOpenedAt !== null,
    openedAt: c.financeOpenedAt,
    params: c.financeOpening,
    conversionDate: c.financeConversionDate ? dateKeyOfDbDate(c.financeConversionDate) : null,
    lockDate: c.financeLockDate ? dateKeyOfDbDate(c.financeLockDate) : null,
    /** 第一次鎖帳前可以重開。 */
    canReopen: c.financeLockDate === null,
    /** 已開帳 → 目前的轉換日；還沒 → 開財務那天。 */
    suggestedDate: c.financeConversionDate && c.financeOpenedAt
      ? dateKeyOfDbDate(c.financeConversionDate)
      : c.financeEnabledAt ? toTaipeiDateKey(c.financeEnabledAt) : null,
  };
}

/**
 * 開帳（或重開）：owner only、還沒鎖帳。刪掉這間教室全部分錄（唯一允許刪除的情況，04 §5），
 * 寫期初分錄，再從轉換日起全量過帳。
 */
export async function openLedger(classroomId: number, userId: number, params: OpeningParams) {
  await requireOwner(userId, classroomId);
  const c = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId }, select: { financeLockDate: true, financeEnabledAt: true } });
  if (!c.financeEnabledAt) throw new ApiError(404, "FINANCE_NOT_ENABLED", "Finance is not enabled");
  if (c.financeLockDate) throw new ApiError(409, "LEDGER_LOCKED", "The ledger has a lock date; it can no longer be reopened");

  const preview = await previewOpening(classroomId, params);
  if (preview.errors.length > 0) {
    throw new ApiError(400, "OPENING_INCOMPLETE", preview.errors.map((e) => `${e.code} ${e.detail}`).join("; "));
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7001, ${classroomId}::int)::text AS ok`;
      // 手動分錄與沖銷是人記的，重開不刪（P5）。
      await tx.journalEntry.deleteMany({ where: { classroomId, kind: { in: ["AUTO", "CORRECTION", "OPENING"] } } });
      await tx.postingSource.deleteMany({ where: { classroomId } });
      await tx.classroom.update({
        where: { id: classroomId },
        data: {
          financeConversionDate: new Date(`${params.conversionDate}T00:00:00Z`),
          financeOpenedAt: new Date(),
          financeOpening: params,
        },
      });
      // 舊卡到期＝轉換日＋6 個月；重開換了轉換日就重算。
      await setLegacyCardExpiry(tx, classroomId, params.conversionDate, c.financeEnabledAt!);
      if (preview.lines.length > 0) {
        await tx.journalEntry.create({
          data: {
            classroomId,
            date: new Date(`${params.conversionDate}T00:00:00Z`),
            kind: "OPENING",
            memo: params.method === "CONVENTION" ? "期初（系統算的）" : "期初（自己填的）",
            createdById: userId,
            lines: {
              createMany: {
                data: preview.lines.map((l) => ({
                  classroomId,
                  date: new Date(`${l.date}T00:00:00Z`),
                  accountId: (l.account as { accountId: number }).accountId,
                  locationId: l.locationId,
                  amount: l.amount,
                  partyType: l.party?.type ?? null,
                  partyId: l.party?.id ?? null,
                })),
              },
            },
          },
        });
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  const sync = await syncLedger(classroomId);
  return { preview: { ...preview, lines: undefined }, sync };
}
