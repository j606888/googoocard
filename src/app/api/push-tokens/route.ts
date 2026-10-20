import prisma from "@/lib/prisma";
import { parseBody, sessionRoute } from "@/lib/apiRoute";
import { deletePushTokenSchema, pushTokenSchema } from "@/lib/schemas";

// App（mobile/）登入後與每次啟動時註冊自己的 Expo push token。
// sessionRoute：token 掛在「人」身上，不是教室——推播時才依教室成員篩選。

export const POST = sessionRoute(async ({ request, userId }) => {
  const { token, platform } = await parseBody(request, pushTokenSchema);

  // 同一支手機換帳號登入：token 改掛到新的人身上，舊帳號就不會再收到這支手機的通知。
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, platform, userId },
    update: { platform, userId },
  });
  return { ok: true };
});

// 登出時呼叫。只刪自己的 token，別人的同字串 token 不受影響（理論上不會發生）。
export const DELETE = sessionRoute(async ({ request, userId }) => {
  const { token } = await parseBody(request, deletePushTokenSchema);
  await prisma.pushToken.deleteMany({ where: { token, userId } });
  return { ok: true };
});
