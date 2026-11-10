// 報表服務（docs/finance-v2/05 §3）：先過帳，再從分錄加總。金額單位「分」，畫面自己換算成元。
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { formatCardSerial } from "@/lib/cardSerial";
import {
  agingBucket,
  balanceSheet,
  cashFlow,
  deferredRollforward,
  generalLedger,
  partyBalances,
  periodProfits,
  profitAndLoss,
  trialBalance,
  type AccountMeta,
  type LedgerRow,
  type Range,
} from "@/domains/ledger/reports";
import { syncLedger } from "./sync";

export const REPORTS = [
  "pnl",
  "balance-sheet",
  "cash-flow",
  "deferred-revenue",
  "receivables",
  "payables",
  "lessons",
  "trial-balance",
  "general-ledger",
] as const;
export type ReportName = (typeof REPORTS)[number];

export type ReportParams = { from?: string; to?: string; asOf?: string; locationId?: number; accountId?: number };

type Ctx = {
  rows: LedgerRow[];
  accounts: AccountMeta[];
  locations: { id: number; name: string }[];
};

export async function loadCtx(classroomId: number): Promise<Ctx> {
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { financeEnabledAt: true } });
  if (!c?.financeEnabledAt) throw new ApiError(404, "FINANCE_NOT_ENABLED", "Finance is not enabled");
  await syncLedger(classroomId);
  const [lines, accounts, locations] = await Promise.all([
    prisma.journalLine.findMany({
      where: { classroomId },
      select: {
        entryId: true,
        date: true,
        accountId: true,
        locationId: true,
        amount: true,
        partyType: true,
        partyId: true,
        lessonPeriodId: true,
        entry: { select: { sourceType: true, kind: true } },
      },
    }),
    prisma.ledgerAccount.findMany({
      where: { classroomId },
      select: { id: true, code: true, name: true, type: true, systemKey: true, parentId: true },
      orderBy: { code: "asc" },
    }),
    prisma.location.findMany({ where: { classroomId }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  return {
    rows: lines.map((l) => ({
      entryId: l.entryId,
      date: l.date.toISOString().slice(0, 10),
      accountId: l.accountId,
      locationId: l.locationId,
      amount: l.amount,
      partyType: l.partyType,
      partyId: l.partyId,
      lessonPeriodId: l.lessonPeriodId,
      sourceType: l.entry.sourceType,
      entryKind: l.entry.kind,
    })),
    accounts,
    locations,
  };
}

function today() {
  return toTaipeiDateKey(new Date());
}

function rangeOf(p: ReportParams): Range {
  const to = p.to ?? today();
  return { from: p.from ?? `${to.slice(0, 7)}-01`, to };
}

/** 對象名稱：卡（學生＋卡號）、單堂（學生）、老師、場地、成員、分部。 */
export async function partyNames(classroomId: number, parties: { partyType: string; partyId: number }[]) {
  const ids = (t: string) => [...new Set(parties.filter((p) => p.partyType === t).map((p) => p.partyId))];
  const [cards, dropIns, teachers, venues, users] = await Promise.all([
    prisma.studentCard.findMany({
      where: { id: { in: ids("STUDENT_CARD") }, student: { classroomId } },
      select: { id: true, serialNumber: true, card: { select: { name: true } }, student: { select: { name: true } } },
    }),
    prisma.dropInCharge.findMany({
      where: { id: { in: ids("DROP_IN") }, attendanceRecord: { student: { classroomId } } },
      select: { id: true, attendanceRecord: { select: { student: { select: { name: true } } } } },
    }),
    prisma.teacher.findMany({ where: { id: { in: ids("TEACHER") }, classroomId }, select: { id: true, name: true } }),
    prisma.venue.findMany({ where: { id: { in: ids("VENUE") }, classroomId }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: ids("USER") }, memberships: { some: { classroomId } } }, select: { id: true, name: true } }),
  ]);
  const m = new Map<string, string>();
  for (const c of cards) m.set(`STUDENT_CARD:${c.id}`, `${c.student.name} · ${c.card.name} ${formatCardSerial(c.serialNumber)}`);
  for (const d of dropIns) m.set(`DROP_IN:${d.id}`, `${d.attendanceRecord.student.name} · 單堂`);
  for (const t of teachers) m.set(`TEACHER:${t.id}`, t.name);
  for (const v of venues) m.set(`VENUE:${v.id}`, v.name);
  for (const u of users) m.set(`USER:${u.id}`, u.name);
  return (partyType: string, partyId: number) => m.get(`${partyType}:${partyId}`) ?? `${partyType} #${partyId}`;
}

export async function runReport(classroomId: number, name: ReportName, p: ReportParams) {
  const ctx = await loadCtx(classroomId);
  const locationIds = ctx.locations.map((l) => l.id);
  const base = { locations: ctx.locations };
  const asOf = p.asOf ?? p.to ?? today();
  const acc = (key: string) => ctx.accounts.find((a) => a.systemKey === key)!;

  switch (name) {
    case "pnl":
      return { ...base, range: rangeOf(p), ...profitAndLoss(ctx.rows, ctx.accounts, rangeOf(p), locationIds) };
    case "balance-sheet":
      return { ...base, ...balanceSheet(ctx.rows, ctx.accounts, asOf, locationIds) };
    case "cash-flow":
      return { ...base, range: rangeOf(p), ...cashFlow(ctx.rows, ctx.accounts, rangeOf(p), locationIds) };
    case "trial-balance":
      return { ...base, asOf, ...trialBalance(ctx.rows, ctx.accounts, asOf, p.locationId) };
    case "deferred-revenue": {
      const r = deferredRollforward(ctx.rows, ctx.accounts, rangeOf(p), p.locationId);
      const nameOf = await partyNames(classroomId, r.cards.map((c) => ({ partyType: "STUDENT_CARD", partyId: c.cardId })));
      const info = new Map(
        (
          await prisma.studentCard.findMany({
            where: { id: { in: r.cards.map((c) => c.cardId) }, student: { classroomId } },
            select: { id: true, createdAt: true, remainingSessions: true, expiresAt: true, isPaid: true },
          })
        ).map((s) => [s.id, s]),
      );
      return {
        ...base,
        range: rangeOf(p),
        ...r,
        cards: r.cards.map((c) => {
          const s = info.get(c.cardId);
          return {
            ...c,
            name: nameOf("STUDENT_CARD", c.cardId),
            purchasedOn: s ? toTaipeiDateKey(s.createdAt) : null,
            remainingSessions: s?.remainingSessions ?? null,
            expiresOn: s?.expiresAt ? toTaipeiDateKey(s.expiresAt) : null,
            isPaid: s?.isPaid ?? true,
          };
        }),
      };
    }
    case "receivables": {
      const list = partyBalances(ctx.rows, [acc("AR").id], asOf, "ASSET").filter((x) => p.locationId === undefined || x.locationId === p.locationId);
      const nameOf = await partyNames(classroomId, list);
      const items = list.map((x) => ({ ...x, name: nameOf(x.partyType, x.partyId), bucket: agingBucket(x.ageDays) }));
      const buckets = { "0-30": 0, "31-60": 0, "60+": 0 } as Record<string, number>;
      for (const i of items) buckets[i.bucket] += i.balance;
      return { ...base, asOf, items, buckets, total: items.reduce((s, i) => s + i.balance, 0) };
    }
    case "payables": {
      const keys = ["TEACHER_PAYABLE", "TEACHER_PAYABLE_HELD", "VENUE_PAYABLE", "OWNER_PAYABLE"] as const;
      const per = keys.map((k) => ({ key: k, items: partyBalances(ctx.rows, [acc(k).id], asOf, "LIABILITY") }));
      const nameOf = await partyNames(classroomId, per.flatMap((x) => x.items));
      // 依對象合併：可發、待學生付款、場地、業主
      const m = new Map<string, { partyType: string; partyId: number; name: string; payable: number; held: number }>();
      for (const { key, items } of per) {
        for (const i of items) {
          if (p.locationId !== undefined && i.locationId !== p.locationId) continue;
          const k = `${i.partyType}:${i.partyId}`;
          const cur = m.get(k) ?? { partyType: i.partyType, partyId: i.partyId, name: nameOf(i.partyType, i.partyId), payable: 0, held: 0 };
          if (key === "TEACHER_PAYABLE_HELD") cur.held += i.balance;
          else cur.payable += i.balance;
          m.set(k, cur);
        }
      }
      const items = [...m.values()].sort((a, b) => b.payable + b.held - (a.payable + a.held));
      return { ...base, asOf, items, totalPayable: items.reduce((s, i) => s + i.payable, 0), totalHeld: items.reduce((s, i) => s + i.held, 0) };
    }
    case "lessons": {
      const range = rangeOf(p);
      const periods = periodProfits(ctx.rows, ctx.accounts, range).filter((x) => p.locationId === undefined || x.locationId === p.locationId);
      const info = await prisma.lessonPeriod.findMany({
        where: { id: { in: periods.map((x) => x.lessonPeriodId) }, lesson: { classroomId } },
        select: { id: true, lesson: { select: { id: true, name: true } }, _count: { select: { attendanceRecords: true } } },
      });
      const byId = new Map(info.map((i) => [i.id, i]));
      const lessons = new Map<number, { lessonId: number; name: string; locationIds: number[]; periods: number; attendance: number; revenue: number; teacher: number; venue: number; gross: number }>();
      for (const x of periods) {
        const i = byId.get(x.lessonPeriodId);
        if (!i) continue;
        const cur = lessons.get(i.lesson.id) ?? { lessonId: i.lesson.id, name: i.lesson.name, locationIds: [], periods: 0, attendance: 0, revenue: 0, teacher: 0, venue: 0, gross: 0 };
        if (!cur.locationIds.includes(x.locationId)) cur.locationIds.push(x.locationId);
        cur.periods++;
        cur.attendance += i._count.attendanceRecords;
        cur.revenue += x.revenue;
        cur.teacher += x.teacher;
        cur.venue += x.venue;
        cur.gross += x.gross;
        lessons.set(i.lesson.id, cur);
      }
      return { ...base, range, lessons: [...lessons.values()].sort((a, b) => b.gross - a.gross), periods };
    }
    case "general-ledger": {
      const account = ctx.accounts.find((a) => a.id === p.accountId);
      if (!account) throw new ApiError(400, "ACCOUNT_REQUIRED", "accountId is required");
      const children = ctx.accounts.filter((a) => a.parentId === account.id).map((a) => a.id);
      const r = generalLedger(ctx.rows, account, children, rangeOf(p), p.locationId);
      // 沒有對象的行（付款、轉帳的現金行）：從同一張分錄的其他行找對象——付給誰、轉給哪個資金帳戶。
      const entryIds = new Set(r.lines.filter((l) => l.partyType === null).map((l) => l.entryId));
      const siblings = new Map<number, LedgerRow[]>();
      for (const row of ctx.rows) {
        if (!entryIds.has(row.entryId)) continue;
        siblings.set(row.entryId, [...(siblings.get(row.entryId) ?? []), row]);
      }
      const moneyAccounts = new Map(
        (await prisma.moneyAccount.findMany({ where: { classroomId }, select: { accountId: true, name: true } })).map((m) => [m.accountId, m.name]),
      );
      const counterOf = (l: LedgerRow): { partyType: string; partyId: number } | { moneyAccount: string; out: boolean } | null => {
        if (l.partyType !== null) return null;
        const others = (siblings.get(l.entryId) ?? []).filter((o) => o.accountId !== l.accountId);
        const ma = others.find((o) => moneyAccounts.has(o.accountId) && Math.sign(o.amount) === -Math.sign(l.amount));
        if (ma) return { moneyAccount: moneyAccounts.get(ma.accountId)!, out: l.amount < 0 };
        // 分部往來的行對象是分部，不算
        const party = others.find((o) => o.partyType !== null && o.partyType !== "LOCATION" && o.partyId !== null);
        return party ? { partyType: party.partyType!, partyId: party.partyId! } : null;
      };
      const counters = r.lines.map(counterOf);
      const nameOf = await partyNames(classroomId, [
        ...r.lines.filter((l) => l.partyType !== null).map((l) => ({ partyType: l.partyType!, partyId: l.partyId! })),
        ...counters.flatMap((c) => (c && "partyType" in c ? [c] : [])),
      ]);
      return {
        ...base,
        range: rangeOf(p),
        account,
        opening: r.opening,
        closing: r.closing,
        lines: r.lines.map((l, i) => {
          const c = counters[i];
          const party = l.partyType
            ? nameOf(l.partyType, l.partyId!)
            : c === null
              ? null
              : "moneyAccount" in c
                ? `${c.out ? "轉給" : "來自"} ${c.moneyAccount}`
                : nameOf(c.partyType, c.partyId);
          return { ...l, party };
        }),
      };
    }
  }
}
