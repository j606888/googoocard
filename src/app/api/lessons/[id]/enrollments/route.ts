import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { registerEnrollmentSchema } from "@/lib/schemas";
import { getEnrollmentRoster, registerEnrollment } from "@/service/termEnrollment";

type Params = { id: string };

// 整期名單（src/service/termEnrollment.ts）：誰報了整期、每堂出缺勤、付了沒。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getEnrollmentRoster(parseId(params.id, "lesson id"), classroomId)
);

// 老師登記一位整期學生：既有學生或新名字；價錢／堂數預設課程的，可個別改。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const input = await parseBody(request, registerEnrollmentSchema);
  const created = await registerEnrollment({
    lessonId: parseId(params.id, "lesson id"),
    classroomId,
    userId,
    input,
  });
  return { enrollmentId: created.id, studentId: created.studentId };
});
