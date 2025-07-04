import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id } = await params;

  const { startTime, endTime } = await request.json();

  await prisma.lessonPeriod.create({
    data: {
      lessonId: parseInt(id),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  });

  return NextResponse.json({ success: true });
}