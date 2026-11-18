import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { assertCanManageFinance } from "@/service/finance/access";
import { packUsage } from "@/service/finance/period";

export const GET = apiRoute(async ({ classroomId }) => {
  const [packs, used] = await Promise.all([
    prisma.venuePack.findMany({ where: { classroomId }, orderBy: [{ purchasedAt: "asc" }, { id: "asc" }] }),
    packUsage(classroomId),
  ]);
  return { packs: packs.map((p) => ({ ...p, used: used.get(p.id) ?? 0 })) };
});

/** 買一包（或記轉換日前買、還剩幾次的包）；錢由場地分部付（負責人）。 */
export const POST = apiRoute(async ({ request, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const body = await parseBody(
    request,
    z.object({
      venueId: z.number().int(),
      sessions: z.number().int().min(1).max(1000),
      price: z.number().int().min(0),
      purchasedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      remainingAtStart: z.number().int().min(0).nullable().optional(),
    })
  );
  const venue = await prisma.venue.findFirst({
    where: { id: body.venueId, classroomId },
    select: { id: true, perSessionPrice: true, location: { select: { keeperUserId: true } } },
  });
  if (!venue) throw badRequest("VENUE_NOT_FOUND", "Venue not in this classroom");
  if (venue.perSessionPrice !== null) throw badRequest("VENUE_PER_SESSION", "This venue is paid per session");
  if (body.remainingAtStart != null && body.remainingAtStart > body.sessions) {
    throw badRequest("PACK_REMAINING_TOO_MANY", "Remaining cannot exceed sessions");
  }
  return prisma.venuePack.create({
    data: {
      classroomId,
      venueId: venue.id,
      sessions: body.sessions,
      price: body.price,
      remainingAtStart: body.remainingAtStart ?? null,
      paidByUserId: venue.location?.keeperUserId ?? userId,
      purchasedAt: body.purchasedDate ? parseTaipeiDateRange(body.purchasedDate).start : new Date(),
      createdById: userId,
    },
  });
});
