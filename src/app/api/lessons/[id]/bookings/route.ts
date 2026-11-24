import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { setBookingsSchema } from "@/lib/schemas";
import { getBookingRoster, setStudentBookings } from "@/service/periodBooking";

type Params = { id: string };

// 預計會來（src/service/periodBooking.ts）：誰預約了哪幾堂、來了沒。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getBookingRoster(parseId(params.id, "lesson id"), classroomId)
);

// 登記／修改一位學生的預約：還沒點名的堂改成剛好 periodIds（空 = 取消還沒上的）。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const { periodIds, note, ...who } = await parseBody(request, setBookingsSchema);
  return setStudentBookings({
    lessonId: parseId(params.id, "lesson id"),
    classroomId,
    userId,
    who,
    periodIds,
    note,
  });
});
