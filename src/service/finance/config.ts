import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { splitRuleSchema } from "@/domains/finance/types";
import { refsOf } from "./rules";

/** keeper／付款人／到期歸屬人必須是這間教室的保管人（isCustodian），否則 400 NOT_FINANCE_MEMBER。 */
export async function assertCustodian(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { isCustodian: true },
  });
  if (!m?.isCustodian) {
    throw new ApiError(400, "NOT_FINANCE_MEMBER", "User is not a custodian of this classroom");
  }
}

/** 場地回給前端的欄位（不要把整列 spread 出去）。 */
export const venueSelect = {
  id: true,
  name: true,
  locationId: true,
  landlordUserId: true,
  perSessionPrice: true,
  archivedAt: true,
} as const;

/** 場地被用過了嗎：分帳規則（整門課或單堂）提到它、有任何次數包（含作廢的）、或帳本／付款有它的分錄。 */
export async function isVenueUsed(venueId: number, classroomId: number): Promise<boolean> {
  const [packs, journal, payouts, rules, overrides] = await Promise.all([
    prisma.venuePack.count({ where: { venueId } }),
    prisma.journalLine.count({ where: { classroomId, partyType: "VENUE", partyId: venueId } }),
    prisma.payout.count({ where: { classroomId, partyType: "VENUE", partyId: venueId } }),
    prisma.lessonSplitRule.findMany({ where: { lesson: { classroomId } }, select: { rule: true } }),
    prisma.periodSplitOverride.findMany({ where: { lessonPeriod: { lesson: { classroomId } } }, select: { rule: true } }),
  ]);
  if (packs + journal + payouts > 0) return true;
  return [...rules, ...overrides].some((r) => {
    const parsed = splitRuleSchema.safeParse(r.rule);
    return parsed.success && refsOf(parsed.data).venueIds.includes(venueId);
  });
}

export async function findVenueInClassroom(venueId: number, classroomId: number) {
  return prisma.venue.findFirst({ where: { id: venueId, classroomId } });
}

export async function requireVenueInClassroom(venueId: number, classroomId: number) {
  const v = await findVenueInClassroom(venueId, classroomId);
  if (!v) throw new ApiError(404, "NOT_FOUND", "Venue not found");
  return v;
}

/** 場地名稱在教室內唯一：撞名（P2002）→ 409 VENUE_NAME_TAKEN，其他錯誤原樣丟出。 */
export async function withVenueNameCheck<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "VENUE_NAME_TAKEN", "A venue with this name already exists");
    }
    throw e;
  }
}

/**
 * 這位成員還被哪些財務設定指著（分部負責人、過期收入對象、房東、舊卡保管人）。
 * 取消他的保管人之前要先改掉，否則會留下指向非保管人的壞參照。只看沒封存的。
 */
export async function custodianReferences(
  db: Prisma.TransactionClient,
  userId: number,
  classroomId: number,
): Promise<string[]> {
  const [keeps, expiries, venues, classroom] = await Promise.all([
    db.location.findMany({ where: { classroomId, archivedAt: null, keeperUserId: userId }, select: { name: true } }),
    db.location.findMany({
      where: { classroomId, archivedAt: null, expiryTo: "USER", expiryUserId: userId },
      select: { name: true },
    }),
    db.venue.findMany({ where: { classroomId, archivedAt: null, landlordUserId: userId }, select: { name: true } }),
    db.classroom.findUnique({ where: { id: classroomId }, select: { legacyCustodianUserId: true } }),
  ]);
  return [
    ...keeps.map((l) => `${l.name}的分部負責人`),
    ...expiries.map((l) => `${l.name}的過期收入對象`),
    ...venues.map((v) => `${v.name}的房東`),
    ...(classroom?.legacyCustodianUserId === userId ? ["舊卡保管人"] : []),
  ];
}
