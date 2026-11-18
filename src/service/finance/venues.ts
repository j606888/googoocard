import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest } from "@/lib/apiError";

export const venueSelect = {
  id: true,
  name: true,
  landlordUserId: true,
  locationId: true,
  perSessionPrice: true,
  archivedAt: true,
} as const;

export const venueBody = z.object({
  name: z.string().trim().min(1).max(50),
  locationId: z.number().int(),
  landlordUserId: z.number().int().nullable().optional(),
  /** null = 買次數包。 */
  perSessionPrice: z.number().int().min(0).nullable().optional(),
});

export async function assertVenueRefs(classroomId: number, body: { locationId?: number; landlordUserId?: number | null }) {
  if (body.locationId !== undefined) {
    const loc = await prisma.location.findFirst({ where: { id: body.locationId, classroomId }, select: { id: true } });
    if (!loc) throw badRequest("VENUE_BAD_BRANCH", "Branch not in this classroom");
  }
  if (body.landlordUserId != null) {
    const m = await prisma.membership.findFirst({ where: { classroomId, userId: body.landlordUserId } });
    if (!m) throw badRequest("LANDLORD_NOT_MEMBER", "Landlord must be a member");
  }
}

