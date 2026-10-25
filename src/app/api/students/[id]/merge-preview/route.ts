import { z } from "zod";
import { apiRoute, parseId, parseQuery } from "@/lib/apiRoute";
import { previewMerge } from "@/service/studentMerge";
import { positiveInt } from "@/lib/schemas";

type Params = { id: string };

// What merging this student (the source, archived afterwards) into `targetId`
// would do — sizes of both sides, the attendance clashes and which record each
// keeps, and whether both are bound to different LINE accounts.
export const GET = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const { targetId } = parseQuery(request, z.object({ targetId: positiveInt }));
  return previewMerge(classroomId, parseId(params.id, "student id"), targetId);
});
