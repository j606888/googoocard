import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { requireLocationInClassroom } from "@/lib/authz";
import { assignLocationSchema } from "@/lib/schemas";

// 「套用到既有課程」：把老師勾選的課一次標上分部。Only this classroom's lessons
// that don't have a location yet are touched — a stale selection or a foreign
// id is silently skipped, and the count says how many actually changed.
export const POST = apiRoute(async ({ request, classroomId }) => {
  const { locationId, lessonIds } = await parseBody(request, assignLocationSchema);
  await requireLocationInClassroom(locationId, classroomId);

  const { count } = await prisma.lesson.updateMany({
    where: { id: { in: lessonIds }, classroomId, locationId: null },
    data: { locationId },
  });
  return { updated: count };
});
