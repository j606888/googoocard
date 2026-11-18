import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";
import { assertVenueRefs, venueBody, venueSelect } from "@/service/finance/venues";
import { assertCanManageFinance } from "@/service/finance/access";

export const GET = apiRoute(async ({ classroomId }) => ({
  venues: await prisma.venue.findMany({ where: { classroomId }, select: venueSelect, orderBy: { id: "asc" } }),
}));

export const POST = apiRoute(async ({ request, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const body = await parseBody(request, venueBody);
  await assertVenueRefs(classroomId, body);
  try {
    return await prisma.venue.create({
      data: {
        classroomId,
        name: body.name,
        locationId: body.locationId,
        landlordUserId: body.landlordUserId ?? null,
        perSessionPrice: body.perSessionPrice ?? null,
      },
      select: venueSelect,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "VENUE_NAME_TAKEN", "Venue name already used");
    throw e;
  }
});
