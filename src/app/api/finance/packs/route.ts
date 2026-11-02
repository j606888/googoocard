import { z } from "zod";
import prisma from "@/lib/prisma";
import { ymdSchema } from "@/lib/schemas";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { assertFinance } from "@/service/finance/access";
import { assertFinanceMember, requireVenueInClassroom } from "@/service/finance/config";

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

const createSchema = z.object({
  venueId: z.number().int().positive(),
  sessions: z.number().int().min(1),
  price: z.number().int().min(0),
  paidByUserId: z.number().int().positive(),
  purchasedAt: ymdSchema,
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const body = await parseBody(request, createSchema);
  await requireVenueInClassroom(body.venueId, classroomId);
  await assertFinanceMember(body.paidByUserId, classroomId);
  return prisma.venuePack.create({
    data: {
      classroomId,
      venueId: body.venueId,
      sessions: body.sessions,
      price: body.price,
      paidByUserId: body.paidByUserId,
      purchasedAt: parseTaipeiDateRange(body.purchasedAt).start,
      createdById: userId,
    },
    select: packSelect,
  });
});
