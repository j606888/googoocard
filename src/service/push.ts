import type { TodoType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendExpoPush } from "@/lib/expoPush";
import { sendWebPush, webPushConfigured } from "@/lib/webPush";
import { countTodos } from "@/service/todos";

export type TodoPush = {
  type: TodoType;
  title: string;
  body: string;
  /** 點開通知後開的站內路徑（App 在 WebView 裡開，網頁由 service worker 開）。 */
  path: string;
};

/**
 * 有新的待處理事項時，推給教室所有成員（管理員、老師、小幫手），排除把這類關掉的人。
 * 所有教室都會發（2026-10 拿掉了教室白名單）：真正的開關在老師自己——
 * 沒裝 App、沒在瀏覽器開啟通知的人本來就收不到。
 *
 * **永遠不 throw**：呼叫端是學生買卡、點名這些主流程，推播失敗只能記 log，
 * 不能讓主流程跟著失敗。呼叫時機一律在交易 commit 之後。
 */
export async function notifyClassroom(classroomId: number, push: TodoPush): Promise<void> {
  try {
    const [members, optedOut] = await Promise.all([
      prisma.membership.findMany({
        // 封存的教室沒有 apiRoute 幫忙擋，要自己排除。
        where: { classroomId, classroom: { deletedAt: null } },
        select: { userId: true },
      }),
      prisma.notificationPreference.findMany({
        where: { classroomId, type: push.type, enabled: false },
        select: { userId: true },
      }),
    ]);
    const optedOutIds = new Set(optedOut.map((p) => p.userId));
    const userIds = members.map((m) => m.userId).filter((id) => !optedOutIds.has(id));
    await sendToUsers(userIds, classroomId, push);
  } catch (error) {
    console.error("[push] notifyClassroom failed", error);
  }
}

/** 推播的內容。`type` 會帶進通知的 data 和瀏覽器通知的 tag（同 tag 的會被取代）。 */
export type PushMessage = { type: string; title: string; body: string; path: string };

/**
 * 推給指定的幾個人（例如水庫的繳回只發給營收負責人）。跟 notifyClassroom 一樣
 * **永遠不 throw**，呼叫時機在交易 commit 之後。不看 NotificationPreference——
 * 那是待處理事項的開關。
 */
export async function notifyUsers(classroomId: number, userIds: number[], push: PushMessage): Promise<void> {
  try {
    await sendToUsers([...new Set(userIds)], classroomId, push);
  } catch (error) {
    console.error("[push] notifyUsers failed", error);
  }
}

async function sendToUsers(userIds: number[], classroomId: number, push: PushMessage) {
  if (userIds.length === 0) return;

  // 圖示數字 = 這間教室的待處理總數。屬於多間教室的人只會看到觸發這次推播的
  // 那一間，打開後會用自己目前的教室重新算。只在真的有裝置要發時才算
  // （每間教室都會走到這裡，大多數老師沒開通知）。
  let counting: Promise<number> | undefined;
  const badge = () => (counting ??= countTodos(classroomId));

  // 兩個管道各自吞錯，一邊壞了不影響另一邊。
  await Promise.all([
    sendToApps(userIds, classroomId, push, badge).catch((error) =>
      console.error("[push] app push failed", error)
    ),
    sendToBrowsers(userIds, classroomId, push, badge).catch((error) =>
      console.error("[push] web push failed", error)
    ),
  ]);
}

async function sendToApps(
  userIds: number[],
  classroomId: number,
  push: PushMessage,
  badge: () => Promise<number>
) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  const count = await badge();
  const tickets = await sendExpoPush(
    tokens.map((t) => ({
      to: t.token,
      title: push.title,
      body: push.body,
      badge: count,
      sound: "default" as const,
      data: { classroomId, type: push.type, path: push.path },
    }))
  );

  // App 被刪掉或關掉通知後，Expo 會回 DeviceNotRegistered——這種 token 不會再好了。
  const deadIds = tokens
    .filter((_, i) => {
      const ticket = tickets[i];
      return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered";
    })
    .map((t) => t.id);
  if (deadIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: deadIds } } });
  }
}

async function sendToBrowsers(
  userIds: number[],
  classroomId: number,
  push: PushMessage,
  badge: () => Promise<number>
) {
  if (!webPushConfigured()) return;
  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;
  const count = await badge();

  // 先切到通知所屬的教室再開頁面（src/app/notification/page.tsx）。
  const url = `/notification?classroomId=${classroomId}&next=${encodeURIComponent(push.path)}`;
  const results = await Promise.all(
    subscriptions.map((sub) =>
      sendWebPush(sub, { title: push.title, body: push.body, url, badge: count, tag: `${push.type}:${push.path}` })
    )
  );

  const goneIds = subscriptions.filter((_, i) => results[i] === "gone").map((s) => s.id);
  if (goneIds.length > 0) {
    await prisma.webPushSubscription.deleteMany({ where: { id: { in: goneIds } } });
  }
}
