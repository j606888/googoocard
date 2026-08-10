import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { toTaipeiMonthKey } from "@/lib/taipei-date";

// 課卡營收：以「購買日期」(StudentCard.createdAt) 歸月、金額用 finalPrice 全額計入。
// 與每日營收 (依上課時段攤提單堂價) 是兩種不同視角，刻意分開。
// 只有已付款 (isPaid) 才算營收；未付款另計 unpaidTotal 供提醒用。
export async function GET() {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentCards = await prisma.studentCard.findMany({
    where: { student: { classroomId } },
    select: { createdAt: true, finalPrice: true, isPaid: true },
  });

  const totals = new Map<
    string,
    { totalRevenue: number; unpaidTotal: number; count: number }
  >();

  for (const studentCard of studentCards) {
    const month = toTaipeiMonthKey(studentCard.createdAt);
    const bucket = totals.get(month) ?? {
      totalRevenue: 0,
      unpaidTotal: 0,
      count: 0,
    };
    if (studentCard.isPaid) {
      bucket.totalRevenue += studentCard.finalPrice;
      bucket.count += 1;
    } else {
      bucket.unpaidTotal += studentCard.finalPrice;
    }
    totals.set(month, bucket);
  }

  const months = [...totals.entries()]
    .map(([month, bucket]) => ({ month, ...bucket }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const years = [
    ...new Set(months.map((m) => Number(m.month.slice(0, 4)))),
  ].sort((a, b) => b - a);

  return NextResponse.json({ years, months });
}
