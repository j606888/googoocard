import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { locationSettingsSchema } from "@/lib/schemas";

// 「在 LINE 公開課表與價目表」：沒綁定的人在官方帳號也看得到這間教室的課表和價目
// （src/service/lineBot.ts resolveLineClassroom）。
export const PATCH = apiRoute(async ({ request, classroomId }) => {
  const { lineListed } = await parseBody(request, locationSettingsSchema);
  await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed } });
  return { lineListed };
});
