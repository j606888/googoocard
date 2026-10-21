import prisma from "@/lib/prisma";
import { parseBody, sessionRoute } from "@/lib/apiRoute";
import { deleteWebPushSubscriptionSchema, webPushSubscriptionSchema } from "@/lib/schemas";

// 網頁版在「帳號」頁開啟通知時，把這個瀏覽器的 Web Push 訂閱交上來（src/hooks/useWebPush.ts）。
// sessionRoute：訂閱掛在「人」身上，跟 App 的 PushToken 一樣，推播時才依教室成員篩選。

export const POST = sessionRoute(async ({ request, userId }) => {
  const { endpoint, keys } = await parseBody(request, webPushSubscriptionSchema);
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  // 同一個瀏覽器換帳號登入：訂閱改掛到新的人身上。
  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, userId },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, userId },
  });
  return { ok: true };
});

// 關掉這個瀏覽器的通知、登出時呼叫。只刪自己的。
export const DELETE = sessionRoute(async ({ request, userId }) => {
  const { endpoint } = await parseBody(request, deleteWebPushSubscriptionSchema);
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId } });
  return { ok: true };
});
