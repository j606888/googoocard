import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { requireLocationInClassroom } from "@/lib/authz";
import { assignLocationSchema } from "@/lib/schemas";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const taipeiWeekday = (d: Date) => new Date(d.getTime() + TAIPEI_OFFSET_MS).getUTCDay();

// 「套用到既有課程」：一次把還沒設定分部的課標上分部（例：週日的課 → 台南）。
// A lesson's weekday is its first period's (Taipei). Lessons that already have
// a location are never touched, so running it twice is harmless.
export const POST = apiRoute(async ({ request, classroomId }) => {
  const { locationId, weekdays } = await parseBody(request, assignLocationSchema);
  await requireLocationInClassroom(locationId, classroomId);

  const lessons = await prisma.lesson.findMany({
    where: { classroomId, locationId: null },
    select: { id: true, periods: { select: { startTime: true }, orderBy: { startTime: "asc" }, take: 1 } },
  });
  const wanted = new Set(weekdays);
  const ids = lessons
    .filter((l) => l.periods[0] && wanted.has(taipeiWeekday(l.periods[0].startTime)))
    .map((l) => l.id);

  const { count } = await prisma.lesson.updateMany({
    where: { id: { in: ids }, classroomId, locationId: null },
    data: { locationId },
  });
  return { updated: count };
});
