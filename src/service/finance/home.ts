import prisma from "@/lib/prisma";
import { monthOf } from "@/domains/finance/months";
import { getTodos } from "@/service/todos";
import { assertFinanceEnabled } from "./access";
import { periodFundLocationId, resolvePackUnitPrices } from "./periods";
import { listSettlementMonths } from "./settlement";
import { unreviewedBranchesFor } from "./branchReview";

const LIST_LIMIT = 50;

const ruleSelect = {
  splitOverride: { select: { rule: true } },
  lesson: { select: { locationId: true, splitRule: { select: { rule: true } } } },
} as const;

/**
 * 財務首頁「要處理的事」。待處理清單的三類（未付款課卡、未付單堂、點名沒綁卡）直接取自
 * `getTodos()`，同一份資料；再加上財務才有的：沒設分帳的課、過去沒點名的時段、次數包用完、
 * 上月未結算、我的分部還沒核對（1 號起）。有時段的項目只列上線日（`financeEnabledAt`）之後的。每一項帶 `locationId`，`null` = 不屬於任何分部，每個分部都看得到：
 * - 「要收錢」的三類依**上課地點**（`Lesson.locationId`）：要去現場收的人才看得到。未付款的卡沒有賣卡分部，
 *   用第一次用那張卡的課；還沒用過 → `null`。
 * - 其他（沒分帳、沒點名）依這堂課的基金（跟瀑布同一個口徑）。
 */
export async function getFinanceHome(classroomId: number, userId: number, now = new Date()) {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const [todos, months, branches, unreviewed] = await Promise.all([
    getTodos(classroomId, now),
    listSettlementMonths(classroomId, now),
    prisma.location.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, name: true, keeperUserId: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    unreviewedBranchesFor(classroomId, userId, now),
  ]);

  // 上線前的時段（沒分部的舊課）不進財務首頁；原本的待處理頁照列。
  const sinceLaunch = <T extends { lessonPeriodStartTime: Date }>(items: T[]) =>
    items.filter((i) => i.lessonPeriodStartTime >= financeEnabledAt);
  const unpaidDropIns = sinceLaunch(todos.unpaidDropIns);
  const unboundAttendance = sinceLaunch(todos.unboundAttendance);

  const lessonIds = [...new Set([...unpaidDropIns.map((d) => d.lessonId), ...unboundAttendance.map((r) => r.lessonId)])];
  const [todoLessons, firstUses, unsplitLessons, uncheckedPeriods, packs, packUse] = await Promise.all([
    prisma.lesson.findMany({
      where: { id: { in: lessonIds }, classroomId },
      select: { id: true, locationId: true },
    }),
    // 未付款的卡：每張卡第一次用的那堂課
    prisma.attendanceRecord.findMany({
      where: { studentCardId: { in: todos.unpaidCards.map((c) => c.id) }, student: { classroomId } },
      select: { studentCardId: true, lessonPeriod: { select: { lesson: { select: { locationId: true } } } } },
      orderBy: [{ lessonPeriod: { startTime: "asc" } }, { id: "asc" }],
    }),
    // 有課沒設分帳：進行中的課，或上線後有時段的課
    prisma.lesson.findMany({
      where: {
        classroomId,
        splitRule: null,
        OR: [{ status: "inProgress" }, { periods: { some: { startTime: { gte: financeEnabledAt } } } }],
      },
      select: { id: true, name: true, locationId: true },
      orderBy: { id: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.lessonPeriod.findMany({
      where: {
        lesson: { classroomId },
        attendanceTakenAt: null,
        startTime: { gte: financeEnabledAt },
        endTime: { lte: now },
      },
      select: {
        id: true,
        startTime: true,
        splitOverride: ruleSelect.splitOverride,
        lesson: { select: { id: true, name: true, ...ruleSelect.lesson.select } },
      },
      orderBy: { startTime: "asc" },
      take: LIST_LIMIT,
    }),
    prisma.venuePack.findMany({
      where: { classroomId, voidedAt: null },
      select: { venueId: true, sessions: true, venue: { select: { name: true } } },
    }),
    resolvePackUnitPrices(classroomId),
  ]);
  const placeOfLesson = new Map(todoLessons.map((l) => [l.id, l.locationId]));
  const firstUsePlace = new Map<number, number | null>();
  for (const r of firstUses) {
    if (r.studentCardId !== null && !firstUsePlace.has(r.studentCardId)) {
      firstUsePlace.set(r.studentCardId, r.lessonPeriod.lesson.locationId);
    }
  }

  // 次數包用完：場地的有效包總次數 ≤ 已經用掉的次數。
  const venues = new Map<number, { venueId: number; venueName: string; sessions: number; used: number }>();
  for (const p of packs) {
    const v = venues.get(p.venueId) ?? { venueId: p.venueId, venueName: p.venue.name, sessions: 0, used: 0 };
    v.sessions += p.sessions;
    venues.set(p.venueId, v);
  }
  for (const use of packUse.values()) {
    const v = venues.get(use.venueId);
    if (v) v.used += 1;
  }

  return {
    myLocationId: branches.find((b) => b.keeperUserId === userId)?.id ?? null,
    branches: branches.map(({ id, name }) => ({ id, name })),
    unsettledMonth: months.openMonth < monthOf(now) ? months.openMonth : null,
    unpaidCards: todos.unpaidCards.map((c) => ({ ...c, locationId: firstUsePlace.get(c.id) ?? null })),
    unpaidDropIns: unpaidDropIns.map((d) => ({ ...d, locationId: placeOfLesson.get(d.lessonId) ?? null })),
    unboundAttendance: unboundAttendance.map((r) => ({ ...r, locationId: placeOfLesson.get(r.lessonId) ?? null })),
    unsplitLessons: unsplitLessons.map((l) => ({ lessonId: l.id, lessonName: l.name, locationId: l.locationId })),
    uncheckedPeriods: uncheckedPeriods.map((p) => ({
      periodId: p.id,
      lessonId: p.lesson.id,
      lessonName: p.lesson.name,
      startTime: p.startTime,
      locationId: periodFundLocationId(p),
    })),
    unreviewedBranches: unreviewed,
    exhaustedPacks: [...venues.values()]
      .filter((v) => v.used >= v.sessions)
      .map((v) => ({ venueId: v.venueId, venueName: v.venueName, overdrawn: v.used - v.sessions, locationId: null })),
  };
}

export type FinanceHome = Awaited<ReturnType<typeof getFinanceHome>>;
