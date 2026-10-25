import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findLocationInClassroom } from "@/lib/authz";
import { updateLocationSchema } from "@/lib/schemas";
import { locationPayloadSelect } from "@/lib/locations";

// No DELETE: locations are only archived, so old lessons keep theirs.
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  const id = parseId(params.id);
  const location = await findLocationInClassroom(id, classroomId);
  if (!location) throw notFound("Location");

  const { archived, ...fields } = await parseBody(request, updateLocationSchema);
  return prisma.location.update({
    where: { id },
    data: {
      ...fields,
      ...(archived === undefined
        ? {}
        : { archivedAt: archived ? (location.archivedAt ?? new Date()) : null }),
    },
    select: locationPayloadSelect,
  });
});
