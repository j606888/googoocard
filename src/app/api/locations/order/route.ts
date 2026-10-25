import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { reorderLocationsSchema } from "@/lib/schemas";
import { locationPayloadSelect } from "@/lib/locations";

// Rewrites every location's sortOrder to its index in `ids` (same contract as
// /api/dance-styles/order: exactly this classroom's ids, each once).
export const PUT = apiRoute(async ({ request, classroomId }) => {
  const { ids } = await parseBody(request, reorderLocationsSchema);

  const existing = await prisma.location.findMany({ where: { classroomId }, select: { id: true } });
  const own = new Set(existing.map((l) => l.id));
  if (ids.length !== own.size || new Set(ids).size !== ids.length || !ids.every((id) => own.has(id))) {
    throw badRequest("LOCATION_ORDER_MISMATCH");
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.location.update({ where: { id }, data: { sortOrder: index } }))
  );

  return prisma.location.findMany({
    where: { classroomId },
    select: locationPayloadSelect,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
});
