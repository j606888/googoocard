import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findDanceStyleInClassroom } from "@/lib/authz";
import { updateDanceStyleSchema } from "@/lib/schemas";
import { danceStylePayloadSelect } from "@/lib/danceStyles";

// No DELETE: styles are only archived, so old lessons and cards keep theirs.
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  const id = parseId(params.id);
  const style = await findDanceStyleInClassroom(id, classroomId);
  if (!style) throw notFound("Dance style");

  const { archived, ...fields } = await parseBody(request, updateDanceStyleSchema);

  // A rename onto another style's name hits @@unique([classroomId, name]) → 409.
  return prisma.danceStyle.update({
    where: { id },
    data: {
      ...fields,
      ...(archived === undefined
        ? {}
        : { archivedAt: archived ? (style.archivedAt ?? new Date()) : null }),
    },
    select: danceStylePayloadSelect,
  });
});
