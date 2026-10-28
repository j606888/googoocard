import prisma from "@/lib/prisma";
import type { Quest } from "@/domains/finance/schemas";
import { getSetting } from "./setting";

/**
 * 新手任務（docs/finance-plan.md §4.4）：依角色合併、去重；真的做到才打勾。
 * 能從資料推出來的就推（建城、開通知、第一次送回…），推不出來的才存 FinanceQuestDone。
 * 老師的任務（看分潤）等第二步才加。
 */

type Role = "owner" | "revenueOwner" | "holder";
type QuestItem = { key: string; label: string; hint?: string; done: boolean; roles: Role[] };

export async function getQuests(classroomId: number, userId: number, role: string) {
  const [setting, rows, pushCount, entryCount, confirmCount, remitCount] = await Promise.all([
    getSetting(classroomId),
    prisma.financeQuestDone.findMany({ where: { classroomId, userId }, select: { quest: true } }),
    prisma.webPushSubscription.count({ where: { userId } }),
    prisma.financeEntry.count({ where: { classroomId, createdById: userId } }),
    prisma.financeRemittance.count({ where: { classroomId, reviewedById: userId, status: "CONFIRMED" } }),
    prisma.financeRemittance.count({ where: { classroomId, fromUserId: userId, status: { not: "WITHDRAWN" } } }),
  ]);
  const done = new Set(rows.map((r) => r.quest as Quest));
  const isRevenueOwner = setting?.revenueOwnerUserId === userId;
  const roles: Role[] = [];
  if (role === "owner") roles.push("owner");
  if (isRevenueOwner) roles.push("revenueOwner");
  else roles.push("holder");

  const all: QuestItem[] = [
    { key: "module", label: "開啟水庫模組", done: true, roles: ["owner"] },
    { key: "chooseOwner", label: "選營收負責人", hint: "保管公司的錢、確認繳回的人", done: Boolean(setting?.revenueOwnerUserId), roles: ["owner"] },
    { key: "notifiedMembers", label: "通知大家加入主畫面", hint: "複製一段訊息貼到 LINE 群組", done: done.has("notifiedMembers"), roles: ["owner"] },
    { key: "setup", label: "建城 5 題", done: Boolean(setting?.setupCompletedAt), roles: ["revenueOwner"] },
    { key: "push", label: "加入主畫面、開通知", hint: "有人送錢來時手機會響", done: pushCount > 0, roles: ["revenueOwner", "holder"] },
    { key: "trial", label: "試玩推車", hint: "練習按一次「收到了」", done: done.has("trial"), roles: ["revenueOwner"] },
    { key: "firstEntry", label: "記第一筆支出", hint: "例如丁丁的場地費", done: entryCount > 0, roles: ["revenueOwner"] },
    { key: "firstConfirm", label: "第一次確認真的繳回", hint: "有人送錢來時會通知你", done: confirmCount > 0, roles: ["revenueOwner"] },
    { key: "viewedBackpack", label: "看一次我的背包", done: done.has("viewedBackpack"), roles: ["holder"] },
    { key: "firstRemit", label: "第一次送回主堡", hint: "背包有錢時按「送回主堡」", done: remitCount > 0, roles: ["holder"] },
  ];
  const quests = all
    .filter((q) => q.roles.some((r) => roles.includes(r)))
    .map((q) => ({ ...q, roles: q.roles.filter((r) => roles.includes(r)) }));
  return { roles, quests, allDone: quests.every((q) => q.done) };
}

export async function markQuest(classroomId: number, userId: number, quest: Quest) {
  await prisma.financeQuestDone.upsert({
    where: { userId_classroomId_quest: { userId, classroomId, quest } },
    create: { userId, classroomId, quest },
    update: {},
  });
  return { ok: true };
}
