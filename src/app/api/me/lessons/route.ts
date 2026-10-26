import { apiRoute } from "@/lib/apiRoute";
import { getMyUpcomingPeriods } from "@/service/myLessons";

/** 我接下來的課 on the lessons page — empty unless you're linked to a teacher. */
export const GET = apiRoute(async ({ userId, classroomId }) => getMyUpcomingPeriods(userId, classroomId));
