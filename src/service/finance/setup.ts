import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/authz";
import { cardUnitValue } from "@/domains/finance/income";
import { formatMoney } from "@/lib/money";
import { listStrayReceivers } from "./strayReceivers";
import { addMonthsTaipei, parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

export const CARD_EXPIRY_MONTHS = 6;

export async function assertClassroomMember(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { id: true },
  });
  if (!m) throw new ApiError(400, "NOT_A_MEMBER", "User is not a member of this classroom");
}

/** 開帳：只有 owner。launchDate 為台北日期 YYYY-MM-DD。 */
export async function enableFinance(args: {
  classroomId: number;
  userId: number;
  launchDate: string;
  legacyCustodianUserId: number;
}) {
  const { classroomId, userId, launchDate, legacyCustodianUserId } = args;
  await requireOwner(userId, classroomId);
  await assertClassroomMember(legacyCustodianUserId, classroomId);

  const launch = parseTaipeiDateRange(launchDate).start;
  const expiresAt = addMonthsTaipei(launchDate, CARD_EXPIRY_MONTHS);

  await prisma.$transaction(async (tx) => {
    // 條件式更新：同時按兩次也只有一次成功。
    const claimed = await tx.classroom.updateMany({
      where: { id: classroomId, financeEnabledAt: null },
      data: { financeEnabledAt: launch, legacyCustodianUserId },
    });
    if (claimed.count === 0) {
      throw new ApiError(409, "FINANCE_ALREADY_ENABLED", "Finance is already enabled");
    }
    await tx.membership.update({
      where: { userId_classroomId: { userId, classroomId } },
      data: { isCustodian: true, canSettle: true },
    });
    await tx.studentCard.updateMany({
      where: { student: { classroomId }, expiredAt: null, remainingSessions: { gt: 0 } },
      data: { expiresAt },
    });
  });

  return { launchDate: toTaipeiDateKey(launch), expiresAt };
}

export type ChecklistKey =
  | "branches"
  | "lessonBranches"
  | "teachers"
  | "venues"
  | "rules"
  | "funds"
  | "receivers"
  | "legacyPrepaid";

export type ChecklistItem = { key: ChecklistKey; done: boolean; detail?: string };

/** 舊卡：上線前就有、沒記收款人、已付款、還有剩格的卡（算 legacy custodian 保管的預收）。 */
export async function legacyPrepaidSummary(classroomId: number, financeEnabledAt: Date) {
  const cards = await prisma.studentCard.findMany({
    where: {
      student: { classroomId },
      paidByUserId: null,
      isPaid: true,
      expiredAt: null,
      remainingSessions: { gt: 0 },
      createdAt: { lt: financeEnabledAt },
    },
    select: { remainingSessions: true, finalPrice: true, totalSessions: true },
  });
  const sessions = cards.reduce((s, c) => s + c.remainingSessions, 0);
  const value = cards.reduce((s, c) => s + cardUnitValue(c) * c.remainingSessions, 0);
  return { cards: cards.length, sessions, amount: Math.round(value) };
}

function venueIdsOfRule(rule: unknown): number[] {
  const lines = (rule as { lines?: { kind?: string; venueId?: number }[] } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  return lines.filter((l) => l.kind === "venuePack" && typeof l.venueId === "number").map((l) => l.venueId!);
}

/**
 * 開帳清單（spec §9），照順序。沒有東西要設定時視為完成（R25）：
 * 沒有進行中的課 → 課程相關項目完成；沒用到場地次數包 → 場地完成。
 */
export async function setupChecklist(classroomId: number): Promise<ChecklistItem[]> {
  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: {
      financeEnabledAt: true,
      legacyCustodianUserId: true,
      legacyPrepaidConfirmedAt: true,
    },
  });
  if (!classroom.financeEnabledAt) {
    throw new ApiError(404, "FINANCE_DISABLED", "Finance is not enabled for this classroom");
  }

  const [locations, lessons, financeMembers, overrides, packs] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId, archivedAt: null },
      select: { keeperUserId: true, fundOpeningConfirmedAt: true },
    }),
    prisma.lesson.findMany({
      where: { classroomId, status: "inProgress" },
      select: {
        locationId: true,
        splitRule: { select: { rule: true } },
        teachers: { select: { teacher: { select: { payerUserId: true, userId: true } } } },
      },
    }),
    prisma.membership.findMany({ where: { classroomId, isCustodian: true }, select: { userId: true } }),
    prisma.periodSplitOverride.findMany({
      where: { lessonPeriod: { lesson: { classroomId, status: "inProgress" } } },
      select: { rule: true },
    }),
    prisma.venuePack.findMany({ where: { classroomId, voidedAt: null }, select: { venueId: true } }),
  ]);
  const financeUserIds = new Set(financeMembers.map((m) => m.userId));
  const venueIdsWithPack = new Set(packs.map((p) => p.venueId));

  const teachers = lessons.flatMap((l) => l.teachers.map((t) => t.teacher));
  const usedVenueIds = new Set([
    ...lessons.flatMap((l) => (l.splitRule ? venueIdsOfRule(l.splitRule.rule) : [])),
    ...overrides.flatMap((o) => venueIdsOfRule(o.rule)),
  ]);

  const legacy = await legacyPrepaidSummary(classroomId, classroom.financeEnabledAt);
  const stray = await listStrayReceivers(classroomId);
  const strayAmount = stray.reduce((s, i) => s + i.amount, 0);
  let custodianName = "";
  if (classroom.legacyCustodianUserId) {
    const u = await prisma.user.findUnique({
      where: { id: classroom.legacyCustodianUserId },
      select: { name: true },
    });
    custodianName = u?.name ?? "";
  }

  return [
    {
      key: "branches",
      done: locations.length > 0 && locations.every((l) => l.keeperUserId != null),
    },
    {
      key: "lessonBranches",
      done: lessons.every((l) => l.locationId != null),
    },
    {
      key: "teachers",
      done:
        teachers.every((t) => t.payerUserId != null || (t.userId != null && financeUserIds.has(t.userId))),
    },
    {
      key: "venues",
      done: [...usedVenueIds].every((id) => venueIdsWithPack.has(id)),
    },
    {
      key: "rules",
      done: lessons.every((l) => l.splitRule != null),
    },
    {
      key: "funds",
      done: locations.length > 0 && locations.every((l) => l.fundOpeningConfirmedAt != null),
    },
    {
      key: "receivers",
      done: stray.length === 0,
      ...(stray.length > 0
        ? { detail: `${stray.length} 筆、$${formatMoney(strayAmount)} 記在不是保管人的人名下` }
        : {}),
    },
    {
      key: "legacyPrepaid",
      done: classroom.legacyPrepaidConfirmedAt != null,
      detail: `舊卡 ${legacy.cards} 張、${legacy.sessions} 格、約 $${formatMoney(legacy.amount)}${
        custodianName ? ` 由 ${custodianName} 保管` : ""
      }`,
    },
  ];
}
