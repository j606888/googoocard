import { z } from "zod";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { mergeStudents } from "@/service/studentMerge";
import { positiveInt } from "@/lib/schemas";

type Params = { id: string };

const mergeSchema = z.object({
  targetId: positiveInt,
  // Required only when both students are bound to different LINE accounts.
  keepLineFrom: z.enum(["source", "target"]).optional(),
});

// Merge this student into `targetId`: cards, attendance, events, tags and
// qualifications move over; this one is archived with `mergedIntoId`.
export const POST = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const { targetId, keepLineFrom } = await parseBody(request, mergeSchema);
  const sourceId = parseId(params.id, "student id");
  await mergeStudents(classroomId, sourceId, targetId, { keepLineFrom });
  return { mergedInto: targetId };
});
