import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { restoreStrayReceivers } from "@/service/finance/strayReceivers";

const ids = z.array(z.number().int().positive()).max(1000);
const postSchema = z.object({ cardIds: ids, dropInIds: ids });

// 復原改記：還給原收款人（可以結算的人；鎖帳後 409）。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, postSchema);
  return restoreStrayReceivers({ classroomId, userId, ...body });
});
