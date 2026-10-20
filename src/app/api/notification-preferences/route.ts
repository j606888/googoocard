import { TodoType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { notificationPreferenceSchema } from "@/lib/schemas";

// 目前教室的推播開關，每一類一個。沒存過的類別 = 開啟（見 NotificationPreference）。

export const GET = apiRoute(async ({ userId, classroomId }) => {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, classroomId },
    select: { type: true, enabled: true },
  });
  const saved = new Map(rows.map((r) => [r.type, r.enabled]));
  return Object.fromEntries(
    Object.values(TodoType).map((type) => [type, saved.get(type) ?? true])
  ) as Record<TodoType, boolean>;
});

export const PUT = apiRoute(async ({ request, userId, classroomId }) => {
  const { type, enabled } = await parseBody(request, notificationPreferenceSchema);
  await prisma.notificationPreference.upsert({
    where: { userId_classroomId_type: { userId, classroomId, type } },
    create: { userId, classroomId, type, enabled },
    update: { enabled },
  });
  return { type, enabled };
});
