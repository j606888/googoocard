import { apiRoute } from "@/lib/apiRoute";
import { getTeachersOverview } from "@/service/teachers";

// The teachers page: every teacher with the lessons they teach and what's next.
export const GET = apiRoute(async ({ classroomId }) => getTeachersOverview(classroomId));
