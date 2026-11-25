import { z } from "zod";
import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { getWeekPeriods } from "@/service/lessonAgenda";

const querySchema = z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** 課程列表「週曆」：?start=YYYY-MM-DD（台北時間那天 00:00 起算 7 天）。 */
export const GET = apiRoute(async ({ request, classroomId, userId }) => {
  const { start } = parseQuery(request, querySchema);
  return getWeekPeriods(classroomId, parseTaipeiDateRange(start).start, userId);
});
