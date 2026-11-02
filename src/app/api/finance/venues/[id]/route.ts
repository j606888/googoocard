import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";
import { requireVenueInClassroom } from "@/service/finance/config";
import { assertClassroomMember } from "@/service/finance/setup";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  landlordUserId: z.number().int().positive().nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const venue = await requireVenueInClassroom(parseId(params.id), classroomId);
  const body = await parseBody(request, patchSchema);
  if (body.landlordUserId != null) await assertClassroomMember(body.landlordUserId, classroomId);
  return prisma.venue.update({
    where: { id: venue.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.landlordUserId !== undefined ? { landlordUserId: body.landlordUserId } : {}),
      // 封存保留第一次的日期。
      ...(body.archived === true && !venue.archivedAt ? { archivedAt: new Date() } : {}),
      ...(body.archived === false ? { archivedAt: null } : {}),
    },
    select: { id: true, name: true, landlordUserId: true, archivedAt: true },
  });
});
