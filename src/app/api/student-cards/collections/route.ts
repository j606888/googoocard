import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

// 下課對帳（設計稿 C3）for one Taipei day: what each person collected, split by
// cash / transfer (so whoever holds the cash can count it against the screen),
// and the students who came that day and still owe for a card.
// 「收到的錢」= 當天確認付款的課卡 ＋ 當天收的單堂費（DropInCharge）。兩種錢進同一個口袋，
// 只算課卡的話收單堂現金的人跟畫面對不起來。
export const GET = apiRoute(async ({ request, classroomId }) => {
  const dateKey = new URL(request.url).searchParams.get("date") ?? toTaipeiDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw badRequest("INVALID_DATE");
  const { start, end } = parseTaipeiDateRange(dateKey);

  const [collected, dropIns, attendees] = await Promise.all([
    prisma.studentCard.groupBy({
      by: ["paidByUserId", "paymentMethod"],
      where: {
        student: { classroomId },
        isPaid: true,
        // 轉換／轉讓產生的卡也是 isPaid + paidAt，但沒有人真的收到錢。
        origin: "PURCHASE",
        paidAt: { gte: start, lt: end },
        finalPrice: { gt: 0 },
      },
      _sum: { finalPrice: true },
      _count: { _all: true },
    }),
    prisma.dropInCharge.groupBy({
      by: ["paidByUserId", "paymentMethod"],
      where: {
        attendanceRecord: { student: { classroomId } },
        isPaid: true,
        paidAt: { gte: start, lt: end },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { student: { classroomId }, lessonPeriod: { startTime: { gte: start, lt: end } } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
  ]);

  // 課卡與單堂費併成「收款人 × 方式」一列一筆。
  const groups = new Map<
    string,
    { receiverUserId: number | null; paymentMethod: (typeof collected)[number]["paymentMethod"]; total: number; count: number }
  >();
  const add = (
    receiverUserId: number | null,
    paymentMethod: (typeof collected)[number]["paymentMethod"],
    total: number,
    count: number
  ) => {
    const key = `${receiverUserId ?? "none"}:${paymentMethod ?? "none"}`;
    const group = groups.get(key) ?? { receiverUserId, paymentMethod, total: 0, count: 0 };
    group.total += total;
    group.count += count;
    groups.set(key, group);
  };
  for (const c of collected) add(c.paidByUserId, c.paymentMethod, c._sum.finalPrice ?? 0, c._count._all);
  for (const d of dropIns) add(d.paidByUserId, d.paymentMethod, d._sum.amount ?? 0, d._count._all);
  const merged = [...groups.values()];

  const receiverIds = merged.flatMap((c) => (c.receiverUserId ? [c.receiverUserId] : []));
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
    collected: merged
      .map((c) => ({
        ...c,
        receiverName: c.receiverUserId ? nameOf.get(c.receiverUserId) ?? null : null,
      }))
      .sort((a, b) => b.total - a.total),
    /** 這一天實際收到的錢（課卡＋單堂）。 */
    collectedTotal: merged.reduce((sum, c) => sum + c.total, 0),
    collectedCount: merged.reduce((sum, c) => sum + c.count, 0),
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
