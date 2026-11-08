import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { findLessonInClassroom, findLocationInClassroom } from "@/lib/authz";
import { assertCanSettle } from "@/service/finance/access";

const patchSchema = z.object({ locationId: z.number().int().positive() });

// 開帳精靈第 2 步：只改課的分部，不用送整份課程表單。財務開著時分部必填，所以不能清成 null。
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const lesson = await findLessonInClassroom(parseId(params.id), classroomId);
  if (!lesson) throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  const { locationId } = await parseBody(request, patchSchema);
  const location = await findLocationInClassroom(locationId, classroomId);
  if (!location || location.archivedAt) throw new ApiError(400, "LOCATION_NOT_FOUND", "Location not found");
  return prisma.lesson.update({
    where: { id: lesson.id },
    data: { locationId },
    select: { id: true, locationId: true },
  });
});
