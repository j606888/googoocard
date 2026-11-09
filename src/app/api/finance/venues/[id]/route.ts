import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { requireLocationInClassroom } from "@/lib/authz";
import { assertCanSettle } from "@/service/finance/access";
import { isVenueUsed, requireVenueInClassroom, venueSelect, withVenueNameCheck } from "@/service/finance/config";
import { assertClassroomMember } from "@/service/finance/setup";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  locationId: z.number().int().positive().optional(),
  landlordUserId: z.number().int().positive().nullable().optional(),
  perSessionPrice: z.number().int().min(0).nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const venue = await requireVenueInClassroom(parseId(params.id), classroomId);
  const body = await parseBody(request, patchSchema);
  if (body.locationId !== undefined) await requireLocationInClassroom(body.locationId, classroomId);
  if (body.landlordUserId != null) await assertClassroomMember(body.landlordUserId, classroomId);
  return withVenueNameCheck(prisma.venue.update({
    where: { id: venue.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.locationId !== undefined ? { locationId: body.locationId } : {}),
      ...(body.landlordUserId !== undefined ? { landlordUserId: body.landlordUserId } : {}),
      ...(body.perSessionPrice !== undefined ? { perSessionPrice: body.perSessionPrice } : {}),
      // 封存保留第一次的日期。
      ...(body.archived === true && !venue.archivedAt ? { archivedAt: new Date() } : {}),
      ...(body.archived === false ? { archivedAt: null } : {}),
    },
    select: venueSelect,
  }));
});

// 只有從沒用過（沒有任何規則、沒有任何次數包，含作廢的）的場地能刪；用過的請封存。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const venue = await requireVenueInClassroom(parseId(params.id), classroomId);
  if (await isVenueUsed(venue.id, classroomId)) {
    throw new ApiError(409, "VENUE_IN_USE", "This venue is used by a split rule or a pack; archive it instead");
  }
  await prisma.venue.delete({ where: { id: venue.id } });
  return { id: venue.id };
});
