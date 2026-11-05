import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { monthOf } from "@/domains/finance/months";
import { assertFinanceEnabled } from "./access";
import { getMonthStatement } from "./settlement";
import type { MonthStatement } from "./settlement";

// 分部核對（.scratch/finance/spec.md「月結」）：負責人確認「該收的都收到、數字對」。不擋結算。
// 核對時存這個分部這個月結果的雜湊；讀的時候重算比對，不同 → 核對失效。
// 這樣不必在每個寫入點（點名、收款、支出、分帳規則…）記得清掉核對。

const r2 = (x: number) => Math.round(x * 100) / 100;

/** 舊的鎖住結算單沒有 fundLocationId → 用上課分部。 */
const fundOf = (p: MonthStatement["periods"][number]) =>
  p.fundLocationId === undefined ? p.locationId : p.fundLocationId;

/** 這個分部這個月的結果（依這堂課的基金歸類）→ 雜湊。只看這個分部，別的分部變了不影響。 */
export function branchHash(statement: MonthStatement, locationId: number): string {
  const periods = statement.periods.filter((p) => fundOf(p) === locationId);
  const periodIds = new Set(periods.map((p) => p.periodId));
  const branch = statement.byBranch.find((b) => b.locationId === locationId);
  const content = {
    periods: periods.map((p) => ({
      id: p.periodId,
      realized: p.income.realized.map((s) => [s.kind, s.refId, r2(s.amount), s.paid, s.holderUserId]),
      pending: p.income.pending.map((n) => [n.kind, n.studentId, n.amount === null ? null : r2(n.amount)]),
      allocations: p.allocations?.map((a) => [a.payee, r2(a.amount)]) ?? null,
    })),
    branch: branch ? [r2(branch.revenue), r2(branch.expenses), r2(branch.fundChange)] : null,
    expenses: statement.expenses.filter((e) => e.locationId === locationId).map((e) => [e.id, r2(e.amount), e.paidByUserId]),
    expiries: statement.expiries
      .filter((e) => e.to.type === "fund" && e.to.locationId === locationId)
      .map((e) => [e.studentCardId, r2(e.value), e.holderUserId]),
    adjustments: statement.adjustments
      .filter((a) => periodIds.has(a.periodId) || a.deltas.some((d) => d.payee.type === "fund" && d.payee.locationId === locationId))
      .map((a) => [a.periodId, a.deltas.map((d) => [d.payee, r2(d.amount)])]),
    unchecked: statement.uncheckedByBranch?.find((u) => u.locationId === locationId)?.count ?? 0,
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export type BranchReviewStatus = {
  locationId: number;
  name: string;
  keeperUserId: number | null;
  reviewedById: number | null;
  reviewedAt: Date | null;
  /** 核對過、而且之後這個分部的結果沒變 */
  valid: boolean;
};

/** 各分部（有負責人、沒封存）這個月的核對狀態。 */
export async function listBranchReviews(
  classroomId: number,
  month: string,
  statement: MonthStatement,
): Promise<BranchReviewStatus[]> {
  const [branches, reviews] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId, archivedAt: null, keeperUserId: { not: null } },
      select: { id: true, name: true, keeperUserId: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.financeBranchReview.findMany({
      where: { classroomId, month },
      select: { locationId: true, reviewedById: true, reviewedAt: true, hash: true },
    }),
  ]);
  const byLocation = new Map(reviews.map((r) => [r.locationId, r]));
  return branches.map((b) => {
    const r = byLocation.get(b.id);
    return {
      locationId: b.id,
      name: b.name,
      keeperUserId: b.keeperUserId,
      reviewedById: r?.reviewedById ?? null,
      reviewedAt: r?.reviewedAt ?? null,
      valid: !!r && r.hash === branchHash(statement, b.id),
    };
  });
}

/** 負責人核對這個分部這個月；再按一次就用現在的結果重新核對。 */
export async function reviewBranch({
  classroomId,
  userId,
  month,
  locationId,
  now = new Date(),
}: {
  classroomId: number;
  userId: number;
  month: string;
  locationId: number;
  now?: Date;
}): Promise<BranchReviewStatus> {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const location = await prisma.location.findFirst({
    where: { id: locationId, classroomId },
    select: { id: true, keeperUserId: true },
  });
  if (!location) throw new ApiError(404, "NOT_FOUND", "Location not found");
  if (location.keeperUserId !== userId) {
    throw new ApiError(403, "NOT_BRANCH_KEEPER", "Only the branch keeper can review it");
  }
  if (month < monthOf(financeEnabledAt) || month > monthOf(now)) {
    throw new ApiError(400, "INVALID_MONTH", "No statement for this month");
  }
  const statement = await getMonthStatement(classroomId, month, now);
  const hash = branchHash(statement, locationId);
  await prisma.financeBranchReview.upsert({
    where: { classroomId_month_locationId: { classroomId, month, locationId } },
    create: { classroomId, month, locationId, reviewedById: userId, reviewedAt: now, hash },
    update: { reviewedById: userId, reviewedAt: now, hash },
  });
  const statuses = await listBranchReviews(classroomId, month, statement);
  return statuses.find((s) => s.locationId === locationId)!;
}

/**
 * 首頁「要處理的事」：台北 5 號過後，上個月（還沒結算）我負責、還沒核對（或核對後又變了）的分部。
 * 結算過的月份不提醒。
 */
export async function unreviewedBranchesFor(
  classroomId: number,
  userId: number,
  now = new Date(),
): Promise<{ month: string; locationId: number; locationName: string }[]> {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const today = monthOf(now);
  if (Number(toTaipeiDateKey(now).slice(8)) <= 5) return [];
  const [y, m] = today.split("-").map(Number);
  const month = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  if (month < monthOf(financeEnabledAt)) return [];
  const mine = await prisma.location.count({ where: { classroomId, archivedAt: null, keeperUserId: userId } });
  if (mine === 0) return [];
  const locked = await prisma.financeSettlement.findUnique({
    where: { classroomId_month: { classroomId, month } },
    select: { id: true },
  });
  if (locked) return [];
  const statement = await getMonthStatement(classroomId, month, now);
  return (await listBranchReviews(classroomId, month, statement))
    .filter((r) => r.keeperUserId === userId && !r.valid)
    .map((r) => ({ month, locationId: r.locationId, locationName: r.name }));
}
