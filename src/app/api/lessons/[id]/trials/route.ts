import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { registerTrialSchema } from "@/lib/schemas";
import { getTrialRoster, registerTrial } from "@/service/trialRoster";

type Params = { id: string };

// 體驗名單（src/service/trialRoster.ts）：這堂課掛的體驗卡，誰報名了、誰上過了。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getTrialRoster(parseId(params.id, "lesson id"), classroomId)
);

// 老師登記一位體驗學員：既有學生或新名字 → 一張這堂課的體驗卡（可當場記收款）。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const input = await parseBody(request, registerTrialSchema);
  const created = await registerTrial({
    lessonId: parseId(params.id, "lesson id"),
    classroomId,
    userId,
    input,
  });
  return { studentCardId: created.id, studentId: created.studentId };
});
