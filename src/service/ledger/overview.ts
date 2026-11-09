// 財務總覽（docs/finance-v2/05 §3.1）：幾個總覽數字、償付一行、近六個月、要處理的事。金額單位「分」。
import prisma from "@/lib/prisma";
import { balanceSheet, monthRange, partyBalances, profitAndLoss, type Range } from "@/domains/ledger/reports";
import { addDays } from "@/domains/ledger/lines";
import { loadCtx } from "./reports";
import { ledgerDates, todayKey } from "./guard";

type ByLoc = { byLocation: Record<number, number>; total: number };
const empty = (ids: number[]): ByLoc => ({ byLocation: Object.fromEntries(ids.map((id) => [id, 0])), total: 0 });
const addTo = (x: ByLoc, loc: number, v: number) => {
  x.byLocation[loc] = (x.byLocation[loc] ?? 0) + v;
  x.total += v;
};

function prevRange(r: Range): Range {
  const days = Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000);
  const to = addDays(r.from, -1);
  return { from: addDays(to, -days), to };
}

export async function financeOverview(classroomId: number, p: { from?: string; to?: string }) {
  const ctx = await loadCtx(classroomId); // 會先過帳
  const d = await ledgerDates(classroomId);
  // 還沒開帳沒有轉換日（帳本也是空的）；今天之前的月份都當沒有帳。
  const conversionDate = d.conversionDate ?? todayKey();
  const ids = ctx.locations.map((l) => l.id);
  const to = p.to ?? todayKey();
  const range: Range = { from: p.from ?? `${to.slice(0, 7)}-01`, to };
  const key = (k: string) => ctx.accounts.find((a) => a.systemKey === k)!.id;

  const pnl = profitAndLoss(ctx.rows, ctx.accounts, range, ids);
  const prev = profitAndLoss(ctx.rows, ctx.accounts, prevRange(range), ids);
  const bs = balanceSheet(ctx.rows, ctx.accounts, range.to, ids);
  const fund = bs.equity.find((l) => l.key === "FUND")!;

  // 資金帳戶
  const mas = await prisma.moneyAccount.findMany({
    where: { classroomId },
    select: { id: true, name: true, holderUserId: true, locationId: true, accountId: true, archivedAt: true },
    orderBy: [{ holderUserId: "asc" }, { id: "asc" }],
  });
  const cash = empty(ids);
  const accounts = mas
    .map((m) => {
      const balance = ctx.rows.filter((r) => r.accountId === m.accountId && r.date <= range.to).reduce((s, r) => s + r.amount, 0);
      addTo(cash, m.locationId, balance);
      return { id: m.id, name: m.name, holderUserId: m.holderUserId, locationId: m.locationId, balance, archived: m.archivedAt !== null };
    })
    .filter((m) => !m.archived || m.balance !== 0);

  // 預收：每張卡的餘額與剩幾堂
  const deferredCards = partyBalances(ctx.rows, [key("DEFERRED_REVENUE")], range.to, "LIABILITY").filter((x) => x.partyType === "STUDENT_CARD");
  const deferred = empty(ids);
  for (const c of deferredCards) addTo(deferred, c.locationId, c.balance);
  const cards = await prisma.studentCard.findMany({
    where: { id: { in: deferredCards.filter((c) => c.balance > 0).map((c) => c.partyId) } },
    select: { remainingSessions: true },
  });

  // 應付（可發＋代墊／分紅）與待學生付款
  const payable = empty(ids);
  const held = empty(ids);
  for (const x of partyBalances(ctx.rows, ["TEACHER_PAYABLE", "VENUE_PAYABLE", "OWNER_PAYABLE"].map(key), range.to, "LIABILITY")) addTo(payable, x.locationId, x.balance);
  for (const x of partyBalances(ctx.rows, [key("TEACHER_PAYABLE_HELD")], range.to, "LIABILITY")) addTo(held, x.locationId, x.balance);

  // 應收
  const ar = partyBalances(ctx.rows, [key("AR")], range.to, "ASSET");
  const receivable = empty(ids);
  for (const x of ar) addTo(receivable, x.locationId, x.balance);

  // 近六個月（轉換日之前的月份是 null）
  const trend: { month: string; income: ByLoc | null; netIncome: ByLoc | null }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = range.to.slice(0, 7).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    const month = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const mr = monthRange(month);
    if (mr.to < conversionDate) {
      trend.push({ month, income: null, netIncome: null });
      continue;
    }
    const x = profitAndLoss(ctx.rows, ctx.accounts, mr, ids);
    trend.push({ month, income: { byLocation: x.income.byLocation, total: x.income.total }, netIncome: x.netIncome });
  }

  // 要處理的事
  const [pendingPayouts, pendingTransfers, sourceErrors] = await Promise.all([
    prisma.payout.findMany({ where: { classroomId, status: "PENDING", voidedAt: null }, select: { amount: true, locationId: true } }),
    prisma.moneyTransfer.findMany({ where: { classroomId, status: "PENDING", voidedAt: null }, select: { amount: true } }),
    // 開帳前不過帳；殘留的錯誤（舊版開帳前跑過 sync）不算。
    d.opened ? prisma.postingSource.count({ where: { classroomId, error: { not: null } } }) : 0,
  ]);
  const lastMonthEnd = addDays(`${todayKey().slice(0, 7)}-01`, -1);
  const arNames = await prisma.studentCard.findMany({
    where: { id: { in: ar.filter((x) => x.partyType === "STUDENT_CARD").map((x) => x.partyId) } },
    select: { id: true, serialNumber: true, student: { select: { id: true, name: true } } },
  });

  return {
    range,
    locations: ctx.locations,
    opened: d.opened,
    conversionDate,
    lockDate: d.lockDate,
    netIncome: pnl.netIncome,
    prevNetIncome: prev.netIncome,
    grossProfit: pnl.grossProfit,
    expenses: { byLocation: pnl.expenses.byLocation, total: pnl.expenses.total },
    cash: { ...cash, accounts },
    deferred: { ...deferred, cards: cards.length, sessions: cards.reduce((s, c) => s + Math.max(0, c.remainingSessions), 0) },
    payable,
    held,
    receivable: { ...receivable, count: ar.length, maxAgeDays: ar.reduce((m, x) => Math.max(m, x.ageDays), 0) },
    fund: { byLocation: fund.byLocation, total: fund.total },
    trend,
    todos: {
      pendingPayouts: { count: pendingPayouts.length, amount: pendingPayouts.reduce((s, x) => s + x.amount, 0) },
      pendingTransfers: { count: pendingTransfers.length, amount: pendingTransfers.reduce((s, x) => s + x.amount, 0) },
      receivables: ar.slice(0, 5).map((x) => {
        const c = arNames.find((n) => x.partyType === "STUDENT_CARD" && n.id === x.partyId);
        return { ...x, studentId: c?.student.id ?? null, studentName: c?.student.name ?? null, serialNumber: c?.serialNumber ?? null };
      }),
      ledgerErrors: sourceErrors,
      closeDue: d.opened && lastMonthEnd >= conversionDate && (d.lockDate === null || d.lockDate < lastMonthEnd) ? lastMonthEnd : null,
    },
  };
}

/** 老師報酬單：一段期間每堂的報酬（含待學生付款），以及這段期間的付款。 */
export async function teacherStatement(classroomId: number, teacherId: number, range: Range) {
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, classroomId }, select: { id: true, name: true } });
  if (!teacher) return null;
  const accts = await prisma.ledgerAccount.findMany({
    where: { classroomId, systemKey: { in: ["TEACHER_PAYABLE", "TEACHER_PAYABLE_HELD"] } },
    select: { id: true, systemKey: true },
  });
  const heldId = accts.find((a) => a.systemKey === "TEACHER_PAYABLE_HELD")!.id;
  const lines = await prisma.journalLine.findMany({
    where: { classroomId, partyType: "TEACHER", partyId: teacherId, accountId: { in: accts.map((a) => a.id) } },
    select: { date: true, accountId: true, amount: true, lessonPeriodId: true, entry: { select: { sourceType: true } } },
  });
  const ymd = (x: Date) => x.toISOString().slice(0, 10);
  const per = new Map<number, { earned: number; held: number }>();
  for (const l of lines) {
    if (l.lessonPeriodId === null || l.entry.sourceType === "PAYOUT") continue;
    const cur = per.get(l.lessonPeriodId) ?? { earned: 0, held: 0 };
    const d = ymd(l.date);
    if (d >= range.from && d <= range.to) cur.earned -= l.amount;
    if (l.accountId === heldId && d <= range.to) cur.held -= l.amount;
    per.set(l.lessonPeriodId, cur);
  }
  const periods = await prisma.lessonPeriod.findMany({
    where: { id: { in: [...per.keys()] } },
    select: { id: true, startTime: true, lesson: { select: { id: true, name: true } }, _count: { select: { attendanceRecords: true, absences: true } } },
    orderBy: { startTime: "asc" },
  });
  const rows = periods
    .map((p) => ({
      lessonPeriodId: p.id,
      startTime: p.startTime,
      lessonId: p.lesson.id,
      lessonName: p.lesson.name,
      students: p._count.attendanceRecords + p._count.absences,
      ...per.get(p.id)!,
    }))
    .filter((r) => r.earned !== 0);
  const balance = (accountId: number) => -lines.filter((l) => l.accountId === accountId && ymd(l.date) <= range.to).reduce((s, l) => s + l.amount, 0);
  const payableId = accts.find((a) => a.systemKey === "TEACHER_PAYABLE")!.id;
  const payouts = await prisma.payout.findMany({
    where: { classroomId, partyType: "TEACHER", partyId: teacherId, voidedAt: null, OR: [{ status: "PENDING" }, { paidDate: { gte: new Date(`${range.from}T00:00:00Z`) } }] },
    orderBy: { id: "desc" },
  });
  return {
    teacher,
    range,
    rows,
    earned: rows.reduce((s, r) => s + r.earned, 0),
    payable: balance(payableId),
    held: balance(heldId),
    payouts: payouts.map((p) => ({
      id: p.id,
      locationId: p.locationId,
      amount: p.amount,
      paidAmount: p.paidAmount,
      status: p.status,
      paidDate: p.paidDate ? ymd(p.paidDate) : null,
      fromMoneyAccountId: p.fromMoneyAccountId,
    })),
  };
}
