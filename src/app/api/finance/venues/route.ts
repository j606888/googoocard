import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";
import { assertClassroomMember } from "@/service/finance/setup";
import { withVenueNameCheck } from "@/service/finance/config";

const venueSelect = {
  id: true,
  name: true,
  landlordUserId: true,
  archivedAt: true,
} as const;

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
  landlordUserId: z.number().int().positive().nullable().optional(),
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const body = await parseBody(request, createSchema);
  if (body.landlordUserId != null) await assertClassroomMember(body.landlordUserId, classroomId);
  return withVenueNameCheck(
    prisma.venue.create({
      data: { classroomId, name: body.name, landlordUserId: body.landlordUserId ?? null },
      select: venueSelect,
    }),
  );
});
