import { apiRoute } from "@/lib/apiRoute";
import { getLessonAgenda } from "@/service/lessonAgenda";

/** 課程列表頂端：下一堂／上課中、還沒點名。 */
export const GET = apiRoute(async ({ classroomId, userId }) =>
  getLessonAgenda(classroomId, new Date(), userId)
);
