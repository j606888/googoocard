import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";

const bodySchema = z.object({
  series: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        lessonIds: z.array(z.number().int().positive()).min(1).max(200),
      })
    )
    .min(1)
    .max(100),
});

/**
 * 「整理課種」：一次把好幾門課歸到各自的課種（`LessonGroup`），課種照名稱找、沒有就建。
 * 全部在一個 transaction 裡；任何一門課不屬於這間教室就整批拒絕。
 */
export const POST = apiRoute(async ({ request, classroomId }) => {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest("INVALID_BODY", "Invalid series");
  const { series } = parsed.data;

  const lessonIds = series.flatMap((s) => s.lessonIds);
  if (new Set(lessonIds).size !== lessonIds.length) {
    throw badRequest("LESSON_IN_TWO_SERIES", "A lesson can only go to one series");
  }
  const owned = await prisma.lesson.count({ where: { id: { in: lessonIds }, classroomId } });
  if (owned !== lessonIds.length) throw badRequest("LESSON_NOT_FOUND", "Lesson not found");

  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const { name, lessonIds: ids } of series) {
      const group = await tx.lessonGroup.upsert({
        where: { name_classroomId: { name, classroomId } },
        create: { name, classroomId },
        update: {},
      });
      const result = await tx.lesson.updateMany({
        where: { id: { in: ids }, classroomId },
        data: { groupId: group.id },
      });
      count += result.count;
    }
    return count;
  });

  return { updated };
});
