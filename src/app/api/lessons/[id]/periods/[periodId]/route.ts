import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: { id: string; periodId: string } }) {
  const { id, periodId } = params;

  await prisma.lessonPeriod.delete({
    where: { id: parseInt(periodId), lessonId: parseInt(id) },
  });

  return NextResponse.json({ success: true });
}
