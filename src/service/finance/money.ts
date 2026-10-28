import prisma from "@/lib/prisma";
import { formatCardSerial } from "@/lib/cardSerial";
import { daysSince, netWorth, oldestUnremitted, signedEntryAmount, type Collection } from "@/domains/finance/money";
import { requireReady, type ReadySetting } from "./setting";

/**
 * 水庫第一步的帳全部從這裡算（docs/finance-plan.md §2「公司的錢怎麼看」）：
 *
 *   大水庫 ＝ 期初餘額 ＋ 營收負責人自己收的課卡 ＋ 確認過的繳回 ± 手記帳
 *   代收人手上 ＝ 期初代收 ＋ 他收的課卡 − 送出的繳回（轉交中＋確認過）
 *   公司的錢 ＝ 大水庫 ＋ 轉交中 ＋ 所有人手上
 *
 * 課卡收款直接讀 StudentCard，只算啟用日之後、origin = PURCHASE、真的有收錢的。
 * 已知限制：換營收負責人時，前一任自己收的卡會變成他手上的代收（沒有存「當時誰是負責人」）。
 */

type Member = { id: number; name: string };

async function loadAll(classroomId: number, setting: ReadySetting) {
  const [cards, openings, remittances, entries, members] = await Promise.all([
    prisma.studentCard.findMany({
      where: {
        student: { classroomId },
        isPaid: true,
        origin: "PURCHASE",
        finalPrice: { gt: 0 },
        paidAt: { gte: setting.startDate },
      },
      select: {
        id: true,
        serialNumber: true,
        finalPrice: true,
        paidAt: true,
        paidByUserId: true,
        paymentMethod: true,
        student: { select: { id: true, name: true } },
        card: { select: { name: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.financeOpeningCustody.findMany({ where: { classroomId } }),
    prisma.financeRemittance.findMany({
      where: { classroomId },
      orderBy: { createdAt: "asc" },
      include: { fromUser: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } },
    }),
    prisma.financeEntry.findMany({
      where: { classroomId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        payeeUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { revisions: true } },
      },
    }),
    prisma.membership.findMany({
      where: { classroomId },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { cards, openings, remittances, entries, members: members.map((m) => m.user as Member) };
}

type Loaded = Awaited<ReturnType<typeof loadAll>>;
type CardRow = Loaded["cards"][number];

const sentStatuses = new Set(["PENDING", "CONFIRMED"]);

function holderFigures(userId: number, data: Loaded, now: Date, setting: ReadySetting) {
  const opening = data.openings.find((o) => o.userId === userId)?.amount ?? 0;
  const cards = data.cards.filter((c) => c.paidByUserId === userId);
  const collected = opening + cards.reduce((sum, c) => sum + c.finalPrice, 0);
  const mine = data.remittances.filter((r) => r.fromUserId === userId);
  const pending = mine.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amount, 0);
  const confirmed = mine.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + r.amount, 0);
  const inHand = collected - pending - confirmed;
  const collections: Collection[] = [
    ...(opening > 0 ? [{ at: setting.startDate, amount: opening }] : []),
    ...cards.map((c) => ({ at: c.paidAt!, amount: c.finalPrice })),
  ];
  const since = oldestUnremitted(collections, pending + confirmed);
  const days = since ? daysSince(since, now) : 0;
  const lastSent = mine.filter((r) => sentStatuses.has(r.status)).at(-1)?.sentOn ?? null;
  return {
    opening,
    collected,
    pending,
    confirmed,
    inHand,
    cardCount: cards.length,
    heldSince: since,
    daysHeld: days,
    overdue: inHand > 0 && days >= setting.overdueDays,
    lastSentOn: lastSent,
  };
}

/** 學生付了、還沒上的堂數值多少（預收）。過期、已轉換或轉讓的不算。 */
async function prepaidValue(classroomId: number, now: Date) {
  const cards = await prisma.studentCard.findMany({
    where: {
      student: { classroomId },
      isPaid: true,
      origin: "PURCHASE",
      remainingSessions: { gt: 0 },
      totalSessions: { gt: 0 },
      convertedToId: null,
      transferredToId: null,
      OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
    },
    select: { finalPrice: true, remainingSessions: true, totalSessions: true },
  });
  let value = 0;
  let sessions = 0;
  for (const c of cards) {
    value += Math.round((c.finalPrice * Math.min(c.remainingSessions, c.totalSessions)) / c.totalSessions);
    sessions += c.remainingSessions;
  }
  return { value, sessions };
}

function vaultFigures(data: Loaded, setting: ReadySetting) {
  const ownerCards = data.cards.filter((c) => c.paidByUserId === setting.revenueOwnerUserId);
  const ownerCollected = ownerCards.reduce((s, c) => s + c.finalPrice, 0);
  const remitted = data.remittances.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + r.amount, 0);
  const live = data.entries.filter((e) => !e.voidedAt);
  const entriesNet = live.reduce((s, e) => s + signedEntryAmount(e.category, e.amount), 0);
  const loans = live.filter((e) => e.category === "OWNER_LOAN");
  const ownerLoan =
    setting.openingOwnerLoan === null && loans.length === 0
      ? null
      : (setting.openingOwnerLoan ?? 0) + loans.reduce((s, e) => s + e.amount, 0);
  return {
    vault: setting.openingBalance + ownerCollected + remitted + entriesNet,
    ownerCollected,
    ownerCardCount: ownerCards.length,
    ownerLoan,
  };
}

function cardView(c: CardRow) {
  return {
    studentCardId: c.id,
    serial: formatCardSerial(c.serialNumber),
    studentId: c.student.id,
    studentName: c.student.name,
    cardName: c.card.name,
    amount: c.finalPrice,
    paidAt: c.paidAt,
    method: c.paymentMethod,
  };
}

function remittanceView(r: Loaded["remittances"][number]) {
  return {
    id: r.id,
    from: r.fromUser,
    amount: r.amount,
    method: r.method,
    reference: r.reference,
    sentOn: r.sentOn,
    note: r.note,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    rejectReason: r.rejectReason,
    createdAt: r.createdAt,
  };
}

function settingView(setting: ReadySetting, members: Member[]) {
  return {
    revenueOwner: members.find((m) => m.id === setting.revenueOwnerUserId) ?? null,
    startDate: setting.startDate,
    openingBalance: setting.openingBalance,
    openingOwnerLoan: setting.openingOwnerLoan,
    overdueDays: setting.overdueDays,
  };
}

/** 總覽：公司的錢、每位代收人、等確認的繳回、不知道誰收的課卡。 */
export async function getOverview(classroomId: number, now = new Date()) {
  const setting = await requireReady(classroomId);
  const [data, prepaid] = await Promise.all([loadAll(classroomId, setting), prepaidValue(classroomId, now)]);
  const v = vaultFigures(data, setting);

  const holderIds = new Set<number>([
    ...data.openings.map((o) => o.userId),
    ...data.remittances.map((r) => r.fromUserId),
    ...data.cards.flatMap((c) => (c.paidByUserId && c.paidByUserId !== setting.revenueOwnerUserId ? [c.paidByUserId] : [])),
  ]);
  const names = new Map(data.members.map((m) => [m.id, m.name]));
  // 已經離開教室的人如果手上還有錢，也要列出來。
  const missing = [...holderIds].filter((id) => !names.has(id));
  if (missing.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } });
    for (const u of users) names.set(u.id, u.name);
  }
  const holders = [...holderIds]
    .map((id) => ({ user: { id, name: names.get(id) ?? "（已離開）" }, isMember: data.members.some((m) => m.id === id), ...holderFigures(id, data, now, setting) }))
    .sort((a, b) => b.inHand - a.inHand);

  const inHands = holders.reduce((s, h) => s + h.inHand, 0);
  const inTransit = holders.reduce((s, h) => s + h.pending, 0);
  const company = v.vault + inTransit + inHands;
  const unknown = data.cards.filter((c) => c.paidByUserId === null);

  return {
    setting: settingView(setting, data.members),
    totals: {
      company,
      vault: v.vault,
      inTransit,
      inHands,
      prepaid: prepaid.value,
      prepaidSessions: prepaid.sessions,
      other: company - prepaid.value,
      ownerLoan: v.ownerLoan,
      netWorth: netWorth(company, prepaid.value, v.ownerLoan ?? 0),
      ownerCollected: v.ownerCollected,
      ownerCardCount: v.ownerCardCount,
    },
    holders,
    pending: data.remittances.filter((r) => r.status === "PENDING").map(remittanceView),
    unknownCards: unknown.map(cardView),
    members: data.members,
  };
}

/**
 * 一位代收人的存摺：期初、課卡收款（＋）、繳回（−，退回和撤回的也列但不算），
 * 每筆後面是手上餘額。
 */
export async function getHolderPassbook(classroomId: number, userId: number, now = new Date()) {
  const setting = await requireReady(classroomId);
  const data = await loadAll(classroomId, setting);
  const user =
    data.members.find((m) => m.id === userId) ??
    (await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }));
  if (!user) return null;

  type Row =
    | { kind: "opening"; at: Date; amount: number }
    | ({ kind: "card"; at: Date } & ReturnType<typeof cardView>)
    | ({ kind: "remittance"; at: Date } & ReturnType<typeof remittanceView>);
  const rows: Row[] = [];
  const opening = data.openings.find((o) => o.userId === userId);
  if (opening) rows.push({ kind: "opening", at: setting.startDate, amount: opening.amount });
  for (const c of data.cards) if (c.paidByUserId === userId) rows.push({ kind: "card", at: c.paidAt!, ...cardView(c) });
  for (const r of data.remittances) if (r.fromUserId === userId) rows.push({ kind: "remittance", at: r.createdAt, ...remittanceView(r) });
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());

  let balance = 0;
  const entries = rows.map((row) => {
    if (row.kind === "remittance") {
      if (sentStatuses.has(row.status)) balance -= row.amount;
    } else {
      balance += row.amount;
    }
    return { ...row, balance };
  });
  const isRevenueOwner = userId === setting.revenueOwnerUserId;
  return {
    user,
    isRevenueOwner,
    setting: settingView(setting, data.members),
    figures: holderFigures(userId, data, now, setting),
    entries: entries.reverse(),
  };
}

/**
 * 大水庫的存摺：期初餘額、營收負責人自己收的課卡、確認過的繳回、手記帳（作廢的也列，不算），
 * 每筆後面是大水庫餘額。
 */
export async function getVaultLedger(classroomId: number) {
  const setting = await requireReady(classroomId);
  const data = await loadAll(classroomId, setting);
  const v = vaultFigures(data, setting);

  type Row =
    | { kind: "opening"; at: Date; amount: number }
    | ({ kind: "card"; at: Date } & ReturnType<typeof cardView>)
    | ({ kind: "remittance"; at: Date } & ReturnType<typeof remittanceView>)
    | {
        kind: "entry";
        at: Date;
        id: number;
        date: Date;
        category: string;
        amount: number;
        signed: number;
        payee: { id: number; name: string } | null;
        payeeName: string | null;
        description: string | null;
        createdBy: { id: number; name: string };
        voidedAt: Date | null;
        revisionCount: number;
      };
  const rows: Row[] = [{ kind: "opening", at: setting.startDate, amount: setting.openingBalance }];
  for (const c of data.cards) {
    if (c.paidByUserId === setting.revenueOwnerUserId) rows.push({ kind: "card", at: c.paidAt!, ...cardView(c) });
  }
  for (const r of data.remittances) {
    if (r.status === "CONFIRMED") rows.push({ kind: "remittance", at: r.reviewedAt ?? r.updatedAt, ...remittanceView(r) });
  }
  for (const e of data.entries) {
    rows.push({
      kind: "entry",
      at: e.date,
      id: e.id,
      date: e.date,
      category: e.category,
      amount: e.amount,
      signed: signedEntryAmount(e.category, e.amount),
      payee: e.payeeUser,
      payeeName: e.payeeName,
      description: e.description,
      createdBy: e.createdBy,
      voidedAt: e.voidedAt,
      revisionCount: e._count.revisions,
    });
  }
  // 期初永遠第一筆；同一天的手記帳排在當天的收款之後。
  const order = { opening: 0, card: 1, remittance: 1, entry: 2 } as const;
  rows.sort((a, b) => a.at.getTime() - b.at.getTime() || order[a.kind] - order[b.kind]);

  let balance = 0;
  const entries = rows.map((row) => {
    if (row.kind === "entry") {
      if (!row.voidedAt) balance += row.signed;
    } else {
      balance += row.amount;
    }
    return { ...row, balance };
  });
  return {
    setting: settingView(setting, data.members),
    vault: v.vault,
    ownerLoan: v.ownerLoan,
    entries: entries.reverse(),
    members: data.members,
  };
}

/** 某人手上現在有多少（送繳回時檢查用）。 */
export async function holderInHand(classroomId: number, userId: number) {
  const setting = await requireReady(classroomId);
  const data = await loadAll(classroomId, setting);
  return { setting, inHand: holderFigures(userId, data, new Date(), setting).inHand };
}
