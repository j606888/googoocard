import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken } from "@/lib/liffAuth";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { resolveLiffClassroom } from "@/service/liffClassroom";

// LIFF「課卡方案」：教室上架中的卡（含體驗課，只顯示價格、不在這裡賣）。學生和還沒綁定的人
// 都能看——教室怎麼選見 resolveLiffClassroom。能不能買由前端用學生的舞種資格判斷
// （canBuyCard），購買走 POST /api/liff/student-cards。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolved = await resolveLiffClassroom(bearerToken(request), {
    studentId: Number(url.searchParams.get("studentId")) || undefined,
    classroomId: Number(url.searchParams.get("classroomId")) || undefined,
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, classrooms: resolved.classrooms }, { status: resolved.status });
  }

  const cards = await prisma.card.findMany({
    where: { classroomId: resolved.classroom.id, expiredAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      sessions: true,
      isTrial: true,
      isPracticeCard: true,
      danceStyleId: true,
      danceStyle: { select: { ...danceStyleSummarySelect, sortOrder: true } },
    },
    orderBy: [{ sessions: "asc" }, { price: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({
    classroom: resolved.classroom,
    classrooms: resolved.listed.length > 1 ? resolved.listed : [],
    cards,
  });
}
