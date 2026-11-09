import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { requireLocationInClassroom } from "@/lib/authz";
import { assertCanSettle } from "@/service/finance/access";
import { assertClassroomMember } from "@/service/finance/setup";
import { venueSelect, withVenueNameCheck } from "@/service/finance/config";

export const GET = apiRoute(async ({ classroomId }) => {
  const venues = await prisma.venue.findMany({
    where: { classroomId },
    select: venueSelect,
    orderBy: { id: "asc" },
  });
  return { venues };
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  locationId: z.number().int().positive(),
  landlordUserId: z.number().int().positive().nullable().optional(),
  /** 每次付多少；null／沒給＝買次數包。 */
  perSessionPrice: z.number().int().min(0).nullable().optional(),
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const body = await parseBody(request, createSchema);
  await requireLocationInClassroom(body.locationId, classroomId);
  if (body.landlordUserId != null) await assertClassroomMember(body.landlordUserId, classroomId);
  return withVenueNameCheck(
    prisma.venue.create({
      data: {
        classroomId,
        name: body.name,
        locationId: body.locationId,
        landlordUserId: body.landlordUserId ?? null,
        perSessionPrice: body.perSessionPrice ?? null,
      },
      select: venueSelect,
    }),
  );
});
