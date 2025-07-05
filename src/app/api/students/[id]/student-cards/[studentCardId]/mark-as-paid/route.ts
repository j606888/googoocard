import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { studentCardId } = await params;

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
  });

  if (!studentCard) {
    return NextResponse.json({ error: "Student card not found" }, { status: 404 });
  }

  await prisma.studentCard.update({
    where: { id: parseInt(studentCardId) },
    data: { paid: true },
  });

  return NextResponse.json({ success: true });
}