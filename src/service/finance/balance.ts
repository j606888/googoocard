import prisma from "@/lib/prisma";
import { residualValueOf } from "@/domains/cardConversion";
import { netPairs, type FlowReason } from "@/domains/finance/flows";
import type { PeriodSnapshot } from "./period";

/**
 * 分部之間誰欠誰（docs/finance-lite.md §8）。不存餘額，每次從三個來源加總：
 * 已結清的時段（快照裡的 flows）、卡到期（錢的分部 ≠ 卡的分部）、轉帳。
 */

export type BalanceFlow = { from: number; to: number; amount: number; reason: FlowReason | "breakage" | "transfer" };

export type BalanceEntry =
  | {
      kind: "period";
      date: Date;
      periodId: number;
      lessonId: number;
      lessonName: string;
      flows: BalanceFlow[];
    }
  | {
      kind: "breakage";
      date: Date;
      studentCardId: number;
      serialNumber: number;
      studentName: string;
      remainingSessions: number;
      flows: BalanceFlow[];
    }
  | {
      kind: "transfer";
      date: Date;
      transferId: number;
      note: string | null;
      flows: BalanceFlow[];
    };

export async function listBalanceEntries(classroomId: number): Promise<BalanceEntry[]> {
  const [settlements, expired, transfers] = await Promise.all([
    prisma.periodSettlement.findMany({
      where: { lessonPeriod: { lesson: { classroomId } } },
      select: {
        snapshot: true,
        lessonPeriod: { select: { id: true, startTime: true, lesson: { select: { id: true, name: true } } } },
      },
    }),
    // 真的過期沒用完的卡：轉換、轉讓走掉的不算（價值跟著新卡走）。
    prisma.studentCard.findMany({
      where: {
        student: { classroomId },
        expiredAt: { not: null },
        convertedToId: null,
        transferredToId: null,
        remainingSessions: { gt: 0 },
        isPaid: true,
        finalPrice: { gt: 0 },
        moneyLocationId: { not: null },
        homeLocationId: { not: null },
      },
      select: {
        id: true,
        serialNumber: true,
        finalPrice: true,
        totalSessions: true,
        remainingSessions: true,
        expiredAt: true,
        moneyLocationId: true,
        homeLocationId: true,
        homeLocation: { select: { financeStartAt: true } },
        student: { select: { name: true } },
      },
    }),
    prisma.branchTransfer.findMany({ where: { classroomId, voidedAt: null } }),
  ]);

  const entries: BalanceEntry[] = [];

  for (const s of settlements) {
    const snap = s.snapshot as unknown as PeriodSnapshot;
    if (!snap.flows?.length) continue;
    entries.push({
      kind: "period",
      date: s.lessonPeriod.startTime,
      periodId: s.lessonPeriod.id,
      lessonId: s.lessonPeriod.lesson.id,
      lessonName: s.lessonPeriod.lesson.name,
      flows: snap.flows,
    });
  }

  for (const c of expired) {
    const start = c.homeLocation?.financeStartAt;
    if (c.moneyLocationId === c.homeLocationId || !start || !c.expiredAt || c.expiredAt < start) continue;
    const amount = residualValueOf(c);
    if (amount <= 0) continue;
    entries.push({
      kind: "breakage",
      date: c.expiredAt,
      studentCardId: c.id,
      serialNumber: c.serialNumber,
      studentName: c.student.name,
      remainingSessions: c.remainingSessions,
      flows: [{ from: c.moneyLocationId!, to: c.homeLocationId!, amount, reason: "breakage" }],
    });
  }

  // 轉帳 from → to 一筆 X：from 付了錢，等於 to 欠 from X（抵掉原本 from 欠 to 的）。
  for (const t of transfers) {
    entries.push({
      kind: "transfer",
      date: t.at,
      transferId: t.id,
      note: t.note,
      flows: [{ from: t.toLocationId, to: t.fromLocationId, amount: t.amount, reason: "transfer" }],
    });
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** 現在每一對分部之間的淨額。 */
export async function getBalances(classroomId: number) {
  const entries = await listBalanceEntries(classroomId);
  return { pairs: netPairs(entries.flatMap((e) => e.flows)), entries };
}

/** 已點名、算錢、但還沒結清的時段（提醒還有錢沒進往來）。 */
export async function listUnsettledPeriods(classroomId: number) {
  const periods = await prisma.lessonPeriod.findMany({
    where: {
      attendanceTakenAt: { not: null },
      settlement: null,
      lesson: { classroomId, location: { financeStartAt: { not: null } } },
    },
    select: {
      id: true,
      startTime: true,
      lesson: { select: { id: true, name: true, locationId: true, location: { select: { financeStartAt: true } } } },
    },
    orderBy: { startTime: "desc" },
  });
  return periods
    .filter((p) => p.lesson.location?.financeStartAt && p.startTime >= p.lesson.location.financeStartAt)
    .map((p) => ({
      periodId: p.id,
      startTime: p.startTime,
      lessonId: p.lesson.id,
      lessonName: p.lesson.name,
      locationId: p.lesson.locationId,
    }));
}
