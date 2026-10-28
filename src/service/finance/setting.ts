import type { FinanceSetting, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import type { PatchSettingInput, SetupInput } from "@/domains/finance/schemas";

/** 建城完成的設定。startDate 一定有值。 */
export type ReadySetting = FinanceSetting & { startDate: Date; setupCompletedAt: Date };

export function getSetting(classroomId: number) {
  return prisma.financeSetting.findUnique({ where: { classroomId } });
}

/** 還沒建城 → 409 FINANCE_NOT_SET_UP。 */
export async function requireReady(classroomId: number): Promise<ReadySetting> {
  const setting = await getSetting(classroomId);
  if (!setting?.setupCompletedAt || !setting.startDate) {
    throw new ApiError(409, "FINANCE_NOT_SET_UP", "水庫還沒建城");
  }
  return setting as ReadySetting;
}

/** 只有營收負責人能確認繳回、記大水庫的帳。 */
export function assertRevenueOwner(setting: FinanceSetting, userId: number) {
  if (setting.revenueOwnerUserId !== userId) {
    throw new ApiError(403, "NOT_REVENUE_OWNER", "只有營收負責人可以做這件事");
  }
}

/** userIds 都是這間教室的成員，否則 400。 */
export async function assertMembers(classroomId: number, userIds: number[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  const count = await prisma.membership.count({ where: { classroomId, userId: { in: unique } } });
  if (count !== unique.length) throw badRequest("NOT_A_MEMBER", "要選這間教室的成員");
}

export function dateKeyToDate(dateKey: string): Date {
  return parseTaipeiDateRange(dateKey).start;
}

/** 建城前只選營收負責人（擁有者／管理員的新手任務）。建城之後改走 patchSetting（要寫原因）。 */
export async function setRevenueOwner(classroomId: number, revenueOwnerUserId: number) {
  const setting = await getSetting(classroomId);
  if (setting?.setupCompletedAt) throw new ApiError(409, "ALREADY_SET_UP", "建城之後換營收負責人要寫原因");
  await assertMembers(classroomId, [revenueOwnerUserId]);
  return prisma.financeSetting.upsert({
    where: { classroomId },
    create: { classroomId, revenueOwnerUserId },
    update: { revenueOwnerUserId },
  });
}

/**
 * 建城（5 題一次送）。可以由有 finance.edit 的人做，或由已經被選為營收負責人的人做；
 * 後者不能把營收負責人換成別人。第一筆繳回確認之前可以重做（＝重新開帳）。
 */
export async function setup(classroomId: number, actorId: number, canEdit: boolean, input: SetupInput) {
  const current = await getSetting(classroomId);
  const isOwner = current?.revenueOwnerUserId === actorId;
  if (!canEdit && !isOwner) throw new ApiError(403, "PERMISSION_DENIED", "要有水庫設定的權限，或是營收負責人");
  if (!canEdit && input.revenueOwnerUserId !== actorId) {
    throw new ApiError(403, "PERMISSION_DENIED", "換營收負責人要有水庫設定的權限");
  }
  if (current?.setupCompletedAt) {
    const confirmed = await prisma.financeRemittance.count({ where: { classroomId, status: "CONFIRMED" } });
    if (confirmed > 0) throw new ApiError(409, "SETUP_LOCKED", "已經確認過繳回，不能重新開帳");
  }
  const custodyUsers = input.openingCustody.map((c) => c.userId);
  if (new Set(custodyUsers).size !== custodyUsers.length) throw badRequest("DUPLICATE_CUSTODY");
  if (custodyUsers.includes(input.revenueOwnerUserId)) {
    throw badRequest("OWNER_CUSTODY", "營收負責人手上的錢算在大水庫裡，不用填期初代收");
  }
  await assertMembers(classroomId, [input.revenueOwnerUserId, ...custodyUsers]);

  const data = {
    revenueOwnerUserId: input.revenueOwnerUserId,
    startDate: dateKeyToDate(input.startDate),
    openingBalance: input.openingBalance,
    openingOwnerLoan: input.openingOwnerLoan,
    setupCompletedAt: new Date(),
  };
  return prisma.$transaction(async (tx) => {
    const setting = await tx.financeSetting.upsert({
      where: { classroomId },
      create: { classroomId, ...data },
      update: data,
    });
    await tx.financeOpeningCustody.deleteMany({ where: { classroomId } });
    if (input.openingCustody.length > 0) {
      await tx.financeOpeningCustody.createMany({
        data: input.openingCustody.map((c) => ({ classroomId, userId: c.userId, amount: c.amount })),
      });
    }
    return setting;
  });
}

/**
 * 建城之後改設定。換營收負責人要有 finance.edit；期初數字營收負責人也能改。
 * 換人、改期初數字都要寫原因，寫一筆 FinanceSettingRevision。
 */
export async function patchSetting(classroomId: number, actorId: number, canEdit: boolean, input: PatchSettingInput) {
  const setting = await requireReady(classroomId);
  if (!canEdit && setting.revenueOwnerUserId !== actorId) {
    throw new ApiError(403, "PERMISSION_DENIED", "要有水庫設定的權限，或是營收負責人");
  }
  const changes: Prisma.FinanceSettingUpdateInput = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const track = (key: "revenueOwnerUserId" | "openingBalance" | "openingOwnerLoan", value: number | null | undefined) => {
    if (value === undefined || value === setting[key]) return;
    before[key] = setting[key];
    after[key] = value;
  };
  if (input.revenueOwnerUserId !== undefined && input.revenueOwnerUserId !== setting.revenueOwnerUserId) {
    if (!canEdit) throw new ApiError(403, "PERMISSION_DENIED", "換營收負責人要有水庫設定的權限");
    await assertMembers(classroomId, [input.revenueOwnerUserId]);
    changes.revenueOwner = { connect: { id: input.revenueOwnerUserId } };
  }
  track("revenueOwnerUserId", input.revenueOwnerUserId);
  track("openingBalance", input.openingBalance);
  track("openingOwnerLoan", input.openingOwnerLoan);
  if (input.openingBalance !== undefined) changes.openingBalance = input.openingBalance;
  if (input.openingOwnerLoan !== undefined) changes.openingOwnerLoan = input.openingOwnerLoan;
  if (input.overdueDays !== undefined) changes.overdueDays = input.overdueDays;

  const logged = Object.keys(after).length > 0;
  if (logged && !input.reason) throw badRequest("REASON_REQUIRED", "改期初數字或換營收負責人要寫原因");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.financeSetting.update({ where: { classroomId }, data: changes });
    if (logged) {
      await tx.financeSettingRevision.create({
        data: {
          classroomId,
          editedById: actorId,
          reason: input.reason!,
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
        },
      });
    }
    return updated;
  });
}
