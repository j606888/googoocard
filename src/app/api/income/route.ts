import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

const TAKE = 10;

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const { searchParams } = new URL(request.url);
  const skipParam = Number(searchParams.get("skip") || "0");
  const skip = Number.isNaN(skipParam) || skipParam < 0 ? 0 : skipParam;

  const records = await prisma.studentCard.findMany({
    where: {
      student: {
        classroomId: classroomId!,
      },
    },
    include: {
      student: true,
      card: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: TAKE + 1,
  });

  const hasMore = records.length > TAKE;

  return NextResponse.json({
    records: records.slice(0, TAKE),
    hasMore,
  });
}
