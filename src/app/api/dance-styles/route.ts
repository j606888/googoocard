import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { createDanceStyleSchema } from "@/lib/schemas";
import { danceStylePayloadSelect } from "@/lib/danceStyles";

// The classroom's dance styles, archived ones included — the management page
// lists both, and old lessons/cards still need to resolve an archived style.
// Pickers filter `archivedAt` themselves.
export const GET = apiRoute(async ({ classroomId }) => {
  return prisma.danceStyle.findMany({
    where: { classroomId },
    select: danceStylePayloadSelect,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
});

export const POST = apiRoute(async ({ request, classroomId }) => {
  const { name, color, hasLevels } = await parseBody(request, createDanceStyleSchema);

  // New styles go to the end of the list. A duplicate name hits
  // @@unique([classroomId, name]) → 409 via apiRoute.
  const last = await prisma.danceStyle.aggregate({
    where: { classroomId },
    _max: { sortOrder: true },
  });

  return prisma.danceStyle.create({
    data: {
      classroomId,
      name,
      color,
      hasLevels,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
    select: danceStylePayloadSelect,
  });
});
