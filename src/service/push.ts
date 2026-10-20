import type { TodoType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendExpoPush } from "@/lib/expoPush";
import { countTodos } from "@/service/todos";

/**
 * 哪些教室會真的發出 App 推播——opt-in 白名單，逗號分隔的教室 id。
 *
 * **未設定 = 一間都不發**（fail-closed），跟續卡提醒的
 * `RENEWAL_REMINDER_CLASSROOM_IDS` 同一個設計：本機與測試永遠不會打到 Expo，
 * 正式站也要明確打開才會發。
 */
export function pushEnabledClassroomIds(): number[] {
  return (process.env.PUSH_CLASSROOM_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export type TodoPush = {
  type: TodoType;
  title: string;
  body: string;
  /** App 點開通知後在 WebView 裡開的站內路徑。 */
  path: string;
};

/**
 * 有新的待處理事項時，推給教室所有成員（owner + 助教），排除把這類關掉的人。
 *
 * **永遠不 throw**：呼叫端是學生買卡、點名這些主流程，推播失敗只能記 log，
 * 不能讓主流程跟著失敗。呼叫時機一律在交易 commit 之後。
 */
export async function notifyClassroom(classroomId: number, push: TodoPush): Promise<void> {
  try {
    if (!pushEnabledClassroomIds().includes(classroomId)) return;

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
    if (userIds.length === 0) return;

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, token: true },
    });
    if (tokens.length === 0) return;

    // App 圖示數字 = 這間教室的待處理總數。屬於多間教室的人只會看到觸發這次推播的
    // 那一間，App 打開後會用自己目前的教室重新算。
    const badge = await countTodos(classroomId);
    const tickets = await sendExpoPush(
      tokens.map((t) => ({
        to: t.token,
        title: push.title,
        body: push.body,
        badge,
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
  } catch (error) {
    console.error("[push] notifyClassroom failed", error);
  }
}
