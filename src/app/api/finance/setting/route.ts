import { apiRoute, parseBody } from "@/lib/apiRoute";
import prisma from "@/lib/prisma";
import { patchSettingSchema } from "@/domains/finance/schemas";
import { getSetting, patchSetting } from "@/service/finance/setting";
import { isSplitBuilt } from "@/service/finance/build";

/** 建城前後都能讀：還沒建城時畫面用它決定顯示建城任務還是施工中。 */
export const GET = apiRoute(
  async ({ classroomId, userId, permissions }) => {
    const [setting, members, custody, splitBuilt] = await Promise.all([
      getSetting(classroomId),
      prisma.membership.findMany({
        where: { classroomId },
        select: { role: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.financeOpeningCustody.findMany({ where: { classroomId }, select: { userId: true, amount: true } }),
      isSplitBuilt(classroomId),
    ]);
    return {
      setting: setting && {
        revenueOwnerUserId: setting.revenueOwnerUserId,
        startDate: setting.startDate,
        openingBalance: setting.openingBalance,
        openingOwnerLoan: setting.openingOwnerLoan,
        overdueDays: setting.overdueDays,
        setupCompletedAt: setting.setupCompletedAt,
        openingCustody: custody,
      },
      members: members.map((m) => ({ ...m.user, role: m.role })),
      /** 建城第 2～4 章（居民、場地、分帳）蓋好了沒。 */
      splitBuilt,
      canEdit: permissions.has("finance.edit"),
      isRevenueOwner: setting?.revenueOwnerUserId === userId,
    };
  },
  { permission: "finance.view" }
);

/** 建城之後改設定（換營收負責人、改期初數字要寫原因）。 */
export const PATCH = apiRoute(
  async ({ request, classroomId, userId, permissions }) =>
    patchSetting(classroomId, userId, permissions.has("finance.edit"), await parseBody(request, patchSettingSchema)),
  { permission: "finance.view" }
);
