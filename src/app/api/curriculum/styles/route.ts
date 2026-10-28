import { apiRoute } from "@/lib/apiRoute";
import { curriculumStyles } from "@/service/curriculum/talk";

/** 技能樹入口：每個舞種有沒有樹、技能數、討論中、有新留言。 */
export const GET = apiRoute(
  async ({ classroomId, userId }) => curriculumStyles(classroomId, userId),
  { permission: "curriculum.view" }
);
