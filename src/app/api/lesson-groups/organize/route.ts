import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { allTeachersInClassroom, requireLocationsInClassroom } from "@/lib/authz";

const lessonId = z.number().int().positive();

const bodySchema = z.object({
  series: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        lessonIds: z.array(lessonId).min(1).max(200),
      })
    )
    .max(200),
  /** 不歸課種的課（groupId 清成 null）。 */
  ungroupLessonIds: z.array(lessonId).max(1000).optional(),
  /** 翻新精靈的步驟 ②③：每一期的分部與小幫手。沒列到的課不動。 */
  lessons: z
    .array(
      z.object({
        id: lessonId,
        locationId: z.number().int().positive().nullable(),
        assistantIds: z.array(z.number().int().positive()).max(20),
      })
    )
    .max(1000)
    .optional(),
});

/**
 * 「翻新精靈」：一次把好幾門課歸到各自的課種（`LessonGroup`，照名稱找、沒有就建），
 * 順便設好每一期的分部與小幫手。全部在一個 transaction 裡；任何一門課、分部、
 * 小幫手不屬於這間教室就整批拒絕。
 *
 * 被這次搬走而變空的舊群組（以前的「週日課程」這類時段班）會一起刪掉；
 * 本來就空的課種（「新增課種」建的）不動。
 */
export const POST = apiRoute(async ({ request, classroomId }) => {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) throw badRequest("INVALID_BODY", "Invalid series");
  const { series, ungroupLessonIds = [], lessons = [] } = parsed.data;

  const groupedIds = [...series.flatMap((s) => s.lessonIds), ...ungroupLessonIds];
  if (new Set(groupedIds).size !== groupedIds.length) {
    throw badRequest("LESSON_IN_TWO_SERIES", "A lesson can only go to one series");
  }
  if (new Set(lessons.map((l) => l.id)).size !== lessons.length) {
    throw badRequest("INVALID_BODY", "A lesson is listed twice");
  }

  const allIds = [...new Set([...groupedIds, ...lessons.map((l) => l.id)])];
  const owned = await prisma.lesson.findMany({
    where: { id: { in: allIds }, classroomId },
    select: { id: true, groupId: true, teachers: { select: { teacherId: true } } },
  });
  if (owned.length !== allIds.length) throw badRequest("LESSON_NOT_FOUND", "Lesson not found");

  await requireLocationsInClassroom(
    lessons.flatMap((l) => (l.locationId === null ? [] : [l.locationId])),
    classroomId
  );
  const assistantIds = [...new Set(lessons.flatMap((l) => l.assistantIds))];
  if (assistantIds.length > 0 && !(await allTeachersInClassroom(assistantIds, classroomId))) {
    throw badRequest("ASSISTANT_NOT_FOUND", "Assistant not found");
  }
  const teachersOf = new Map(owned.map((l) => [l.id, l.teachers.map((t) => t.teacherId)]));
  for (const lesson of lessons) {
    if (lesson.assistantIds.some((id) => teachersOf.get(lesson.id)!.includes(id))) {
      throw badRequest("ASSISTANT_IS_TEACHER", "A lesson's teacher can't also assist it");
    }
  }

  const previousGroupIds = [
    ...new Set(
      owned
        .filter((l) => groupedIds.includes(l.id))
        .flatMap((l) => (l.groupId === null ? [] : [l.groupId]))
    ),
  ];

  const result = await prisma.$transaction(async (tx) => {
    let updated = 0;
    for (const { name, lessonIds: ids } of series) {
      const group = await tx.lessonGroup.upsert({
        where: { name_classroomId: { name, classroomId } },
        create: { name, classroomId },
        update: {},
      });
      const moved = await tx.lesson.updateMany({
        where: { id: { in: ids }, classroomId },
        data: { groupId: group.id },
      });
      updated += moved.count;
    }
    if (ungroupLessonIds.length > 0) {
      const loosened = await tx.lesson.updateMany({
        where: { id: { in: ungroupLessonIds }, classroomId },
        data: { groupId: null },
      });
      updated += loosened.count;
    }

    for (const lesson of lessons) {
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { locationId: lesson.locationId },
      });
      await tx.lessonAssistant.deleteMany({ where: { lessonId: lesson.id } });
      if (lesson.assistantIds.length > 0) {
        await tx.lessonAssistant.createMany({
          data: [...new Set(lesson.assistantIds)].map((teacherId) => ({
            lessonId: lesson.id,
            teacherId,
          })),
        });
      }
    }

    const removed =
      previousGroupIds.length === 0
        ? { count: 0 }
        : await tx.lessonGroup.deleteMany({
            where: { id: { in: previousGroupIds }, classroomId, lessons: { none: {} } },
          });
    return { updated, removedGroups: removed.count };
  });

  return result;
});
