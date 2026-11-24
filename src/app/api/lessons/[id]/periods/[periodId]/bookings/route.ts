import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { bookPeriodSchema } from "@/lib/schemas";
import { bookPeriod, getPeriodBookings } from "@/service/periodBooking";

type Params = { id: string; periodId: string };

// 點名頁：這一堂預計會來的人。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getPeriodBookings(parseId(params.id, "lesson id"), parseId(params.periodId, "period id"), classroomId)
);

// 點名頁「＋ 預計會來」：只登記這一堂。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const { note, ...who } = await parseBody(request, bookPeriodSchema);
  return bookPeriod({
    lessonId: parseId(params.id, "lesson id"),
    periodId: parseId(params.periodId, "period id"),
    classroomId,
    userId,
    who,
    note,
  });
});
