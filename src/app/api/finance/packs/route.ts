import { z } from "zod";
import prisma from "@/lib/prisma";
import { ymdSchema } from "@/lib/schemas";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { assertCanRecordPayment, assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { assertCustodian, requireVenueInClassroom } from "@/service/finance/config";

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
  const packs = await prisma.venuePack.findMany({
    where: { classroomId, ...(Number.isInteger(venueId) && venueId > 0 ? { venueId } : {}) },
    select: packSelect,
    orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
  });
  return { packs };
});

const base = {
  venueId: z.number().int().positive(),
  paidByUserId: z.number().int().positive(),
};

const newPackSchema = z.object({
  ...base,
  sessions: z.number().int().min(1),
  price: z.number().int().min(0),
  purchasedAt: ymdSchema,
});

// 開帳：上線前買的包、還剩 N 次。價值＝包價 ÷ 總次數 × N，日期記在上線前一天（視為上線前已付）。
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

const DAY_MS = 24 * 60 * 60 * 1000;

// 可以結算的人記任何人付的；保管人只能記自己付的新包。開帳的舊包只有可以結算的人。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, createSchema);
  if ("before" in body) await assertCanSettle(userId, classroomId);
  else await assertCanRecordPayment(userId, classroomId, body.paidByUserId);
  await requireVenueInClassroom(body.venueId, classroomId);
  await assertCustodian(body.paidByUserId, classroomId);
  let pack: { sessions: number; price: number; purchasedAt: Date };
  if ("before" in body) {
    const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
    const { totalSessions, totalPrice, remaining } = body.before;
    pack = {
      sessions: remaining,
      price: Math.round((totalPrice * remaining) / totalSessions),
      purchasedAt: new Date(financeEnabledAt.getTime() - DAY_MS),
    };
  } else {
    pack = { sessions: body.sessions, price: body.price, purchasedAt: parseTaipeiDateRange(body.purchasedAt).start };
  }
  return prisma.venuePack.create({
    data: {
      classroomId,
      venueId: body.venueId,
      ...pack,
      paidByUserId: body.paidByUserId,
      createdById: userId,
    },
    select: packSelect,
  });
});
