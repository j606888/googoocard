import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { listStrayReceivers } from "./strayReceivers";
import { ensureLedgerSetup } from "@/service/ledger/setup";
import { addMonthsTaipei, parseTaipeiDateRange } from "@/lib/taipei-date";

export const CARD_EXPIRY_MONTHS = 6;

export async function assertClassroomMember(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { id: true },
  });
  if (!m) throw new ApiError(400, "NOT_A_MEMBER", "User is not a member of this classroom");
}

/**
 * 開財務：只有 owner。不問日期——financeEnabledAt＝現在，只是「開了」的旗標；
 * 財務從哪天算起由開帳時選的轉換日決定（service/finance/start.ts）。
 * 舊卡的到期日也等開帳才設（轉換日＋CARD_EXPIRY_MONTHS，見 ledger/opening.ts）。
 */
export async function enableFinance(args: { classroomId: number; userId: number; legacyCustodianUserId: number }) {
  const { classroomId, userId, legacyCustodianUserId } = args;
  await requireOwner(userId, classroomId);
  await assertClassroomMember(legacyCustodianUserId, classroomId);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 條件式更新：同時按兩次也只有一次成功。
    const claimed = await tx.classroom.updateMany({
      where: { id: classroomId, financeEnabledAt: null },
      data: { financeEnabledAt: now, legacyCustodianUserId },
    });
    if (claimed.count === 0) {
      throw new ApiError(409, "FINANCE_ALREADY_ENABLED", "Finance is already enabled");
    }
    await tx.membership.update({
      where: { userId_classroomId: { userId, classroomId } },
      data: { isCustodian: true, canSettle: true },
    });
    // 舊卡的錢在他手上 → 他必須是保管人。
    if (legacyCustodianUserId !== userId) {
      await tx.membership.update({
        where: { userId_classroomId: { userId: legacyCustodianUserId, classroomId } },
        data: { isCustodian: true },
      });
    }
    await ensureLedgerSetup(classroomId, tx);
  });

  return { enabledAt: now };
}

/**
 * 開帳（或重開）時設舊卡的到期日：還有剩格、沒關閉的舊卡 → 轉換日＋CARD_EXPIRY_MONTHS。
 * 舊卡＝開財務之前或轉換日之前賣的（開財務之後賣的卡建立時就有自己的到期日，studentCard.ts）。
 * 開財務到開帳之間，舊卡的 expiresAt 維持原樣（通常是 null＝不會過期）。
 */
export async function setLegacyCardExpiry(
  tx: Prisma.TransactionClient,
  classroomId: number,
  conversionDate: string,
  enabledAt: Date,
) {
  const conversionStart = parseTaipeiDateRange(conversionDate).start;
  await tx.studentCard.updateMany({
    where: {
      student: { classroomId },
      expiredAt: null,
      remainingSessions: { gt: 0 },
      createdAt: { lt: conversionStart > enabledAt ? conversionStart : enabledAt },
    },
    data: { expiresAt: addMonthsTaipei(conversionDate, CARD_EXPIRY_MONTHS) },
  });
}

export type ChecklistKey =
  | "branches"
  | "lessonBranches"
  | "venues"
  | "rules"
  | "receivers"
  | "cash"
  | "payables"
  | "opening";

export type ChecklistItem = {
  key: ChecklistKey;
  done: boolean;
  detail?: string;
  /** 還沒做完的那幾筆，可直接點過去（例：沒標分部的課）。 */
  links?: { label: string; href: string }[];
};

function venueIdsOfRule(rule: unknown): number[] {
  const lines = (rule as { lines?: { kind?: string; venueId?: number }[] } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  return lines.filter((l) => l.kind === "venuePack" && typeof l.venueId === "number").map((l) => l.venueId!);
}

/**
 * 開帳清單（spec §9），照順序。沒有東西要設定時視為完成（R25）：
 * 沒有進行中的課 → 課程相關項目完成。場地至少要建一個；規則用到的場地要有分部和收費方式
 * （每次多少，或至少一包）。
 */
export async function setupChecklist(classroomId: number): Promise<ChecklistItem[]> {
  return (await loadSetup(classroomId)).items;
}

/** 開帳精靈第 2、4 步要的進行中課程（分部、有沒有分帳規則）。 */
export type SetupLesson = { id: number; name: string; locationId: number | null; hasRule: boolean };

export async function loadSetup(classroomId: number): Promise<{ items: ChecklistItem[]; lessons: SetupLesson[] }> {
  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: {
      financeEnabledAt: true,
      financeNoVenueFee: true,
      financeOpenedAt: true,
      financeConversionDate: true,
    },
  });
  if (!classroom.financeEnabledAt) {
    throw new ApiError(404, "FINANCE_DISABLED", "Finance is not enabled for this classroom");
  }

  const [locations, lessons, overrides, packs, venues] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId, archivedAt: null },
      select: { keeperUserId: true },
    }),
    prisma.lesson.findMany({
      where: { classroomId, status: "inProgress" },
      select: {
        id: true,
        name: true,
        locationId: true,
        splitRule: { select: { rule: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.periodSplitOverride.findMany({
      where: { lessonPeriod: { lesson: { classroomId, status: "inProgress" } } },
      select: { rule: true },
    }),
    prisma.venuePack.findMany({ where: { classroomId, voidedAt: null }, select: { venueId: true } }),
    prisma.venue.findMany({
      where: { classroomId },
      select: { id: true, name: true, locationId: true, perSessionPrice: true, archivedAt: true },
    }),
  ]);
  const venueIdsWithPack = new Set(packs.map((p) => p.venueId));

  const lessonsWithoutBranch = lessons.filter((l) => l.locationId == null);
  const usedVenueIds = new Set([
    ...lessons.flatMap((l) => (l.splitRule ? venueIdsOfRule(l.splitRule.rule) : [])),
    ...overrides.flatMap((o) => venueIdsOfRule(o.rule)),
  ]);

  const venueCount = venues.filter((v) => !v.archivedAt).length;
  // 規則用到的場地：要有分部，而且有收費方式（每次多少，或至少一包）。
  const venuesMissingBilling = venues.filter(
    (v) => usedVenueIds.has(v.id) && (v.locationId == null || (v.perSessionPrice == null && !venueIdsWithPack.has(v.id))),
  );

  const stray = await listStrayReceivers(classroomId);
  const strayAmount = stray.reduce((s, i) => s + i.amount, 0);
  const items: ChecklistItem[] = [
    {
      key: "branches",
      done: locations.length > 0 && locations.every((l) => l.keeperUserId != null),
    },
    {
      key: "lessonBranches",
      done: lessonsWithoutBranch.length === 0,
      ...(lessonsWithoutBranch.length > 0
        ? { links: lessonsWithoutBranch.map((l) => ({ label: l.name, href: `/lessons/${l.id}` })) }
        : {}),
    },
    {
      key: "venues",
      // 勾了「這間教室不用場地費」就算完成
      done: classroom.financeNoVenueFee || (venueCount > 0 && venuesMissingBilling.length === 0),
      ...(!classroom.financeNoVenueFee && venuesMissingBilling.length > 0
        ? { detail: `還沒設好分部或收費：${venuesMissingBilling.map((v) => v.name).join("、")}` }
        : {}),
    },
    {
      key: "rules",
      done: lessons.every((l) => l.splitRule != null),
      ...(lessons.some((l) => l.splitRule == null)
        ? { detail: `還沒設：${lessons.filter((l) => l.splitRule == null).length} 門課` }
        : {}),
    },
    {
      key: "receivers",
      done: stray.length === 0,
      ...(stray.length > 0
        ? { detail: `${stray.length} 筆、$${formatMoney(strayAmount)} 記在不是保管人的人名下` }
        : {}),
    },
    // 第 6、7 步只是開帳的草稿（存在畫面上，按開帳才一起送出）：伺服器只知道開帳了沒，畫面再依填過沒打勾。
    { key: "cash", done: classroom.financeOpenedAt != null },
    { key: "payables", done: classroom.financeOpenedAt != null },
    {
      key: "opening",
      done: classroom.financeOpenedAt != null,
      ...(classroom.financeConversionDate
        ? { detail: `從 ${classroom.financeConversionDate.toISOString().slice(0, 10).replaceAll("-", "/")} 開帳` }
        : {}),
    },
  ];
  return {
    items,
    lessons: lessons.map((l) => ({ id: l.id, name: l.name, locationId: l.locationId, hasRule: l.splitRule != null })),
  };
}
