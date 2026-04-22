import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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
      attendanceTakenAt: true,
    },
    orderBy: {
      attendanceTakenAt: "desc",
    },
  });

  const dates = [...new Set(
    periods
      .map((period) => period.attendanceTakenAt)
      .filter((value): value is Date => value !== null)
      .map((value) => toDateKey(value))
  )];

  const years = [...new Set(dates.map((date) => Number(date.slice(0, 4))))].sort(
    (a, b) => b - a
  );

  return NextResponse.json({
    years,
    dates,
  });
}
