import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { parseTaipeiMonthRange, toTaipeiDateKey } from "@/lib/taipei-date";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

// 單月課卡購買明細 — 展開某個月時才載入，回答「這個月的營收是誰買了什麼卡湊出來的」。
// 與月營收列表一致：排除 origin = CONVERSION（轉換卡沒有新金流）。
export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  const { month } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MONTH_KEY.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const { start, end } = parseTaipeiMonthRange(month);

  const studentCards = await prisma.studentCard.findMany({
    where: {
      student: { classroomId },
      origin: "PURCHASE",
      createdAt: { gte: start, lt: end },
    },
    include: {
      student: { select: { id: true, name: true } },
      card: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const purchases = studentCards.map((studentCard) => ({
    id: studentCard.id,
    date: toTaipeiDateKey(studentCard.createdAt),
    studentId: studentCard.student.id,
    studentName: studentCard.student.name,
    cardName: studentCard.card.name,
    finalPrice: studentCard.finalPrice,
    isPaid: studentCard.isPaid,
  }));

  const totalRevenue = purchases
    .filter((p) => p.isPaid)
    .reduce((sum, p) => sum + p.finalPrice, 0);
  const unpaidTotal = purchases
    .filter((p) => !p.isPaid)
    .reduce((sum, p) => sum + p.finalPrice, 0);

  return NextResponse.json({ month, totalRevenue, unpaidTotal, purchases });
}
