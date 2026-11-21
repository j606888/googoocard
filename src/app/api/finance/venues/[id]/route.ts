import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { assertCanManageFinance } from "@/service/finance/access";
import { assertVenueRefs, venueBody, venueSelect } from "@/service/finance/venues";

type Params = { id: string };

async function requireVenue(raw: string, classroomId: number) {
  const id = parseId(raw, "venue id");
  const venue = await prisma.venue.findFirst({ where: { id, classroomId }, select: { id: true } });
  if (!venue) throw notFound("Venue");
  return id;
}

export const PATCH = apiRoute<Params>(async ({ request, params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const id = await requireVenue(params.id, classroomId);
  const body = await parseBody(request, venueBody.partial().extend({ archived: z.boolean().optional() }));
  await assertVenueRefs(classroomId, body);
  const { archived, ...rest } = body;
  try {
    return await prisma.venue.update({
      where: { id },
      data: { ...rest, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}) },
      select: venueSelect,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "VENUE_NAME_TAKEN", "Venue name already used");
    throw e;
  }
});

/** 從沒用過（沒有包、沒被規則或結清提到）才能刪，否則改封存。 */
export const DELETE = apiRoute<Params>(async ({ params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const id = await requireVenue(params.id, classroomId);
  const [packs, rules, overrides, settled] = await Promise.all([
    prisma.venuePack.count({ where: { venueId: id } }),
    prisma.lessonSplitRule.findMany({ where: { lesson: { classroomId } }, select: { rule: true } }),
    prisma.periodSplitOverride.findMany({ where: { lessonPeriod: { lesson: { classroomId } } }, select: { rule: true } }),
    prisma.periodSettlement.findMany({ where: { lessonPeriod: { lesson: { classroomId } } }, select: { snapshot: true } }),
  ]);
  const mentions = (json: unknown) => JSON.stringify(json).includes(`"venueId":${id}`);
  if (packs > 0 || [...rules, ...overrides].some((r) => mentions(r.rule)) || settled.some((s) => mentions(s.snapshot))) {
    throw new ApiError(409, "VENUE_IN_USE", "Venue is in use; archive it instead");
  }
  await prisma.venue.delete({ where: { id } });
  return { success: true };
});
