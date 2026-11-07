// 過帳同步（docs/finance-v2/03 §3.3）：每個來源算出應有分錄，跟已過帳的比，只記差額。
// 冪等：沒變就什麼都不寫。鎖帳日（含）以前的差額記到鎖帳日隔天。
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { postCard } from "@/domains/ledger/post/card";
import { postPeriod } from "@/domains/ledger/post/period";
import { postExpense, postVenuePack } from "@/domains/ledger/post/cash";
import { postCashCount, postMoneyTransfer, postOwnerTxn, postPayout } from "@/domains/ledger/post/settle";
import type { PostResult } from "@/domains/ledger/post/types";
import { applyLockDate, balanceByBranch, diffLines, groupByDate, unbalanced, type DesiredLine } from "@/domains/ledger/lines";
import type { AccountRef } from "@/domains/ledger/accounts";
import { loadLedgerInputs, type LedgerInputs } from "./load";

export type SourceType = "CARD" | "PERIOD" | "EXPENSE" | "VENUE_PACK" | "PAYOUT" | "MONEY_TRANSFER" | "OWNER_TXN" | "CASH_COUNT";
const sourceKey = (t: string, id: number) => `${t}:${id}`;

export type SyncResult = {
  entriesWritten: number;
  sourcesChanged: number;
  errors: { sourceType: string; sourceId: number; error: string }[];
};

/** 純計算：每個來源的應有分錄（科目已換成 accountId、已補分部往來）。 */
export function desiredBySource(inputs: LedgerInputs): {
  desired: Map<string, DesiredLine[]>;
  errors: Map<string, string>;
} {
  const desired = new Map<string, DesiredLine[]>();
  const errors = new Map<string, string>();
  const { ctx } = inputs;

  const resolve = (ref: AccountRef): AccountRef => {
    if ("accountId" in ref) return ref;
    if ("moneyAccountId" in ref) {
      const id = inputs.accountIdOfMoney.get(ref.moneyAccountId);
      if (id === undefined) throw new Error(`no ledger account for money account ${ref.moneyAccountId}`);
      return { accountId: id };
    }
    const id = inputs.accountIdOfKey[ref.key];
    if (id === undefined) throw new Error(`no ledger account for ${ref.key}`);
    return { accountId: id };
  };

  const add = (type: SourceType, id: number, result: PostResult) => {
    const key = sourceKey(type, id);
    if (result.errors.length > 0) {
      errors.set(key, [...new Set(result.errors)].join(","));
      return;
    }
    let lines: DesiredLine[];
    try {
      lines = balanceByBranch(result.lines).map((l) => ({ ...l, account: resolve(l.account) }));
    } catch (e) {
      errors.set(key, e instanceof Error ? e.message : String(e));
      return;
    }
    if (lines.length > 0) desired.set(key, lines);
  };

  for (const c of inputs.cards) add("CARD", c.id, postCard(c, ctx, inputs.convertedFrom.get(c.id) ?? []));
  for (const p of inputs.periods) add("PERIOD", p.id, postPeriod(p, ctx));
  for (const e of inputs.expenses) add("EXPENSE", e.id, postExpense(e, ctx));
  for (const p of inputs.packs) add("VENUE_PACK", p.id, postVenuePack(p, ctx));
  for (const p of inputs.payouts) add("PAYOUT", p.id, postPayout(p, ctx));
  for (const t of inputs.transfers) add("MONEY_TRANSFER", t.id, postMoneyTransfer(t, ctx));
  for (const o of inputs.ownerTxns) add("OWNER_TXN", o.id, postOwnerTxn(o, ctx));
  for (const c of inputs.cashCounts) add("CASH_COUNT", c.id, postCashCount(c, ctx));
  return { desired, errors };
}

type PostedRow = {
  sourceType: string;
  sourceId: number;
  date: Date;
  accountId: number;
  locationId: number;
  partyType: string | null;
  partyId: number | null;
  lessonPeriodId: number | null;
  amount: bigint | number;
};

async function loadPosted(tx: Prisma.TransactionClient, classroomId: number): Promise<Map<string, DesiredLine[]>> {
  const rows = await tx.$queryRaw<PostedRow[]>`
    SELECT e."sourceType", e."sourceId", l."date", l."accountId", l."locationId",
           l."partyType", l."partyId", l."lessonPeriodId", SUM(l."amount") AS amount
    FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE l."classroomId" = ${classroomId} AND e."sourceType" IS NOT NULL
    GROUP BY e."sourceType", e."sourceId", l."date", l."accountId", l."locationId",
             l."partyType", l."partyId", l."lessonPeriodId"
    HAVING SUM(l."amount") <> 0`;
  const out = new Map<string, DesiredLine[]>();
  for (const r of rows) {
    const key = sourceKey(r.sourceType, r.sourceId);
    const list = out.get(key) ?? [];
    list.push({
      date: r.date.toISOString().slice(0, 10),
      account: { accountId: r.accountId },
      locationId: r.locationId,
      amount: Number(r.amount),
      ...(r.partyType !== null && r.partyId !== null ? { party: { type: r.partyType as never, id: r.partyId } } : {}),
      ...(r.lessonPeriodId !== null ? { lessonPeriodId: r.lessonPeriodId } : {}),
    });
    out.set(key, list);
  }
  return out;
}

/** 整間教室過帳一次。沒啟用財務 → 什麼都不做。 */
export async function syncLedger(classroomId: number): Promise<SyncResult> {
  const inputs = await loadLedgerInputs(classroomId);
  if (!inputs) return { entriesWritten: 0, sourcesChanged: 0, errors: [] };
  const { desired, errors } = desiredBySource(inputs);

  return prisma.$transaction(
    async (tx) => {
      // 同一間教室同時只有一個 sync（兩個分頁同時打開財務頁不會重複過帳）。
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(7001, ${classroomId}::int)::text AS ok`;
      const posted = await loadPosted(tx, classroomId);
      let entriesWritten = 0;
      let sourcesChanged = 0;

      const keys = new Set([...desired.keys(), ...posted.keys()]);
      for (const key of keys) {
        if (errors.has(key)) continue; // 有錯的來源保留上次的分錄
        const [sourceType, idStr] = key.split(":");
        const sourceId = Number(idStr);
        const prev = posted.get(key) ?? [];
        const delta = applyLockDate(diffLines(desired.get(key) ?? [], prev), inputs.lockDate);
        if (delta.length === 0) continue;
        const bad = unbalanced(delta);
        if (bad.length > 0) throw new Error(`ledger sync produced an unbalanced delta for ${key}: ${JSON.stringify(bad)}`);
        sourcesChanged++;
        for (const [date, lines] of groupByDate(delta)) {
          await tx.journalEntry.create({
            data: {
              classroomId,
              date: new Date(`${date}T00:00:00Z`),
              kind: posted.has(key) ? "CORRECTION" : "AUTO",
              sourceType,
              sourceId,
              lines: {
                createMany: {
                  data: lines.map((l) => ({
                    classroomId,
                    date: new Date(`${l.date}T00:00:00Z`),
                    accountId: (l.account as { accountId: number }).accountId,
                    locationId: l.locationId,
                    amount: l.amount,
                    partyType: l.party?.type ?? null,
                    partyId: l.party?.id ?? null,
                    lessonPeriodId: l.lessonPeriodId ?? null,
                    memo: l.memo ?? null,
                  })),
                },
              },
            },
          });
          entriesWritten++;
        }
      }

      // 過帳失敗的來源：記下原因；成功的清掉舊的錯誤。
      await tx.postingSource.deleteMany({ where: { classroomId, error: { not: null } } });
      if (errors.size > 0) {
        await tx.postingSource.createMany({
          data: [...errors].map(([key, error]) => {
            const [sourceType, id] = key.split(":");
            return { classroomId, sourceType, sourceId: Number(id), error };
          }),
        });
      }

      return {
        entriesWritten,
        sourcesChanged,
        errors: [...errors].map(([key, error]) => {
          const [sourceType, id] = key.split(":");
          return { sourceType, sourceId: Number(id), error };
        }),
      };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
