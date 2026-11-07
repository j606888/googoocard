// 帳本健康檢查（docs/finance-v2/02 §5 恆等式）。結帳清單與「重新檢查帳本」用。
import prisma from "@/lib/prisma";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { cardRemainingValue, cardUsageValues, usageValueKey } from "@/domains/ledger/post/card";
import { loadLedgerInputs } from "./load";

export type LedgerProblem =
  | { code: "UNBALANCED_ENTRY"; entryId: number; locationId: number; amount: number }
  | { code: "INTERBRANCH_NONZERO"; amount: number }
  | { code: "DEFERRED_MISMATCH"; studentCardId: number; ledger: number; expected: number }
  | { code: "SOURCE_ERROR"; sourceType: string; sourceId: number; error: string };

/** 回傳發現的問題（空陣列＝健康）。不會先 sync；呼叫端要的話自己先 syncLedger。 */
export async function checkLedger(classroomId: number): Promise<LedgerProblem[]> {
  const problems: LedgerProblem[] = [];

  const unbalanced = await prisma.$queryRaw<{ entryId: number; locationId: number; amount: bigint }[]>`
    SELECT "entryId", "locationId", SUM("amount") AS amount FROM "JournalLine"
    WHERE "classroomId" = ${classroomId}
    GROUP BY "entryId", "locationId" HAVING SUM("amount") <> 0`;
  for (const r of unbalanced) problems.push({ code: "UNBALANCED_ENTRY", entryId: r.entryId, locationId: r.locationId, amount: Number(r.amount) });

  const ib = await prisma.$queryRaw<{ amount: bigint | null }[]>`
    SELECT SUM(l."amount") AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a."id" = l."accountId"
    WHERE l."classroomId" = ${classroomId} AND a."systemKey" = 'INTERBRANCH'`;
  const ibTotal = Number(ib[0]?.amount ?? 0);
  if (ibTotal !== 0) problems.push({ code: "INTERBRANCH_NONZERO", amount: ibTotal });

  for (const s of await prisma.postingSource.findMany({ where: { classroomId, error: { not: null } } })) {
    problems.push({ code: "SOURCE_ERROR", sourceType: s.sourceType, sourceId: s.sourceId, error: s.error! });
  }

  // 預收：轉換日之後買的卡，帳上的預收 ＝ 剩餘價值 ＋ 還沒點名的時段扣掉的格子（還沒認列）。
  const inputs = await loadLedgerInputs(classroomId);
  if (inputs) {
    const deferredId = inputs.accountIdOfKey.DEFERRED_REVENUE;
    const rows = await prisma.journalLine.groupBy({
      by: ["partyId"],
      where: { classroomId, accountId: deferredId, partyType: "STUDENT_CARD" },
      _sum: { amount: true },
    });
    const ledger = new Map(rows.map((r) => [r.partyId!, -(r._sum.amount ?? 0)]));
    for (const c of inputs.cards) {
      if (toTaipeiDateKey(c.createdAt) < inputs.ctx.conversionDate) continue;
      if (c.convertedToId !== null || c.transferredToId !== null) continue; // 預收已搬到新卡
      const values = cardUsageValues(c);
      const unrecognized = c.usages
        .filter((u) => !u.checked)
        .reduce((s, u) => s + (values.get(usageValueKey(u.kind, u.id)) ?? 0), 0);
      const expected = c.expiredAt ? 0 : cardRemainingValue(c) + unrecognized;
      const got = ledger.get(c.id) ?? 0;
      if (got !== expected) problems.push({ code: "DEFERRED_MISMATCH", studentCardId: c.id, ledger: got, expected });
    }
  }
  return problems;
}
