import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { createLocationSchema } from "@/lib/schemas";
import { locationPayloadSelect } from "@/lib/locations";

// The classroom's 分部, archived included (old lessons still resolve theirs),
// plus whether the classroom's schedule/prices are public on the LINE bot —
// that toggle lives on the same page.
export const GET = apiRoute(async ({ classroomId }) => {
  const [locations, classroom] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId },
      select: locationPayloadSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.classroom.findUniqueOrThrow({ where: { id: classroomId }, select: { lineListed: true } }),
  ]);
  return { locations, lineListed: classroom.lineListed };
});

export const POST = apiRoute(async ({ request, classroomId }) => {
  const { name, address } = await parseBody(request, createLocationSchema);

  // Appended at the end; a duplicate name hits @@unique → 409 via apiRoute.
  const last = await prisma.location.aggregate({ where: { classroomId }, _max: { sortOrder: true } });
  return prisma.location.create({
    data: { classroomId, name, address: address ?? null, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    select: locationPayloadSelect,
  });
});
