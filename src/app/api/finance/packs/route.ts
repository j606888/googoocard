import { z } from "zod";
import prisma from "@/lib/prisma";
import { ymdSchema } from "@/lib/schemas";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { assertCanRecordPayment, assertCanSettle } from "@/service/finance/access";
import { BEFORE_CONVERSION_PURCHASED_AT } from "@/service/finance/start";
import { assertCustodian, requireVenueInClassroom } from "@/service/finance/config";
import { packUsage } from "@/service/finance/periods";
import { ApiError } from "@/lib/apiError";

const packSelect = {
  id: true,
  venueId: true,
  sessions: true,
  price: true,
  paidByUserId: true,
  purchasedAt: true,
  voidedAt: true,
} as const;

export const GET = apiRoute(async ({ request, classroomId }) => {
  const venueId = Number(new URL(request.url).searchParams.get("venueId"));
  const [packs, used] = await Promise.all([
    prisma.venuePack.findMany({
      where: { classroomId, ...(Number.isInteger(venueId) && venueId > 0 ? { venueId } : {}) },
      select: packSelect,
      orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
    }),
    // 先買先用、每包已經用掉幾次（還沒開帳 → 都是 0）。
    packUsage(classroomId),
  ]);
  return { packs: packs.map((p) => ({ ...p, used: used.get(p.id) ?? 0 })) };
});

const base = {
  venueId: z.number().int().positive(),
};

const newPackSchema = z.object({
  ...base,
  sessions: z.number().int().min(1),
  price: z.number().int().min(0),
  purchasedAt: ymdSchema,
});

// 開帳：轉換日前買的包、還剩 N 次。價值＝包價 ÷ 總次數 × N，日期記在任何轉換日之前（視為轉換日前已付）。
const beforeLaunchSchema = z.object({
  ...base,
  before: z
    .object({
      totalSessions: z.number().int().min(1),
      totalPrice: z.number().int().min(0),
      remaining: z.number().int().min(1),
    })
    .refine((b) => b.remaining <= b.totalSessions, { message: "remaining exceeds totalSessions" }),
});

const createSchema = z.union([newPackSchema, beforeLaunchSchema]);

/**
 * 付款人不由使用者選：是場地所屬分部「現在」的負責人（錢從他在這個分部的資金帳戶出）。
 * 場地沒分部 → 400 VENUE_NO_BRANCH；分部沒負責人 → 400 BRANCH_NO_KEEPER。
 * 可以結算的人能記任何包；負責人自己（保管人）能記他付的新包。開帳的舊包只有可以結算的人。
 */
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, createSchema);
  if ("before" in body) await assertCanSettle(userId, classroomId);
  const venue = await requireVenueInClassroom(body.venueId, classroomId);
  if (venue.locationId === null) {
    throw new ApiError(400, "VENUE_NO_BRANCH", "Set the venue's branch before recording a pack");
  }
  const location = await prisma.location.findUniqueOrThrow({ where: { id: venue.locationId }, select: { keeperUserId: true } });
  if (location.keeperUserId === null) {
    throw new ApiError(400, "BRANCH_NO_KEEPER", "The venue's branch has no keeper");
  }
  const paidByUserId = location.keeperUserId;
  if (!("before" in body)) await assertCanRecordPayment(userId, classroomId, paidByUserId);
  await assertCustodian(paidByUserId, classroomId);
  let pack: { sessions: number; price: number; purchasedAt: Date };
  if ("before" in body) {
    const { totalSessions, totalPrice, remaining } = body.before;
    pack = {
      sessions: remaining,
      price: Math.round((totalPrice * remaining) / totalSessions),
      // 「之前買的」一定落在轉換日之前（開帳時算成預付），開帳前記、或之後重開換日子都一樣。
      purchasedAt: BEFORE_CONVERSION_PURCHASED_AT,
    };
  } else {
    pack = { sessions: body.sessions, price: body.price, purchasedAt: parseTaipeiDateRange(body.purchasedAt).start };
  }
  return prisma.venuePack.create({
    data: {
      classroomId,
      venueId: body.venueId,
      ...pack,
      paidByUserId,
      createdById: userId,
    },
    select: packSelect,
  });
});
