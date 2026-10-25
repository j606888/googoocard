import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

// 下課對帳（設計稿 C3）for one Taipei day: what each person collected, split by
// cash / transfer (so whoever holds the cash can count it against the screen),
// and the students who came that day and still owe for a card.
export const GET = apiRoute(async ({ request, classroomId }) => {
  const dateKey = new URL(request.url).searchParams.get("date") ?? toTaipeiDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw badRequest("INVALID_DATE");
  const { start, end } = parseTaipeiDateRange(dateKey);

  const [collected, attendees] = await Promise.all([
    prisma.studentCard.groupBy({
      by: ["paidByUserId", "paymentMethod"],
      where: {
        student: { classroomId },
        isPaid: true,
        paidAt: { gte: start, lt: end },
        finalPrice: { gt: 0 },
      },
      _sum: { finalPrice: true },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { student: { classroomId }, lessonPeriod: { startTime: { gte: start, lt: end } } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
  ]);

  const receiverIds = collected.flatMap((c) => (c.paidByUserId ? [c.paidByUserId] : []));
  const receivers = await prisma.user.findMany({
    where: { id: { in: receiverIds } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(receivers.map((u) => [u.id, u.name]));

  const unpaid = await prisma.studentCard.findMany({
    where: { isPaid: false, studentId: { in: attendees.map((a) => a.studentId) } },
    select: {
      id: true,
      serialNumber: true,
      finalPrice: true,
      totalSessions: true,
      remainingSessions: true,
      createdAt: true,
      card: { select: { name: true } },
      student: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    date: dateKey,
    collected: collected
      .map((c) => ({
        receiverUserId: c.paidByUserId,
        receiverName: c.paidByUserId ? nameOf.get(c.paidByUserId) ?? null : null,
        paymentMethod: c.paymentMethod,
        total: c._sum.finalPrice ?? 0,
        count: c._count._all,
      }))
      .sort((a, b) => b.total - a.total),
    unpaid: unpaid.map((sc) => ({
      studentCardId: sc.id,
      serialNumber: sc.serialNumber,
      cardName: sc.card.name,
      finalPrice: sc.finalPrice,
      usedSessions: sc.totalSessions - sc.remainingSessions,
      createdAt: sc.createdAt,
      student: sc.student,
    })),
  };
});
