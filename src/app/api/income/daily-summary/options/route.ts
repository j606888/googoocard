import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

const TAIPEI_OFFSET_MINUTES = 8 * 60;

function toDateKey(date: Date) {
  const localMs = date.getTime() + TAIPEI_OFFSET_MINUTES * 60 * 1000;
  const localDate = new Date(localMs);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: {
        classroomId: classroomId!,
      },
      attendanceTakenAt: {
        not: null,
      },
    },
    select: {
      startTime: true,
    },
    orderBy: {
      startTime: "desc",
    },
  });

  const dates = [...new Set(periods.map((period) => toDateKey(period.startTime)))];

  const years = [...new Set(dates.map((date) => Number(date.slice(0, 4))))].sort(
    (a, b) => b - a
  );

  return NextResponse.json({
    years,
    dates,
  });
}
