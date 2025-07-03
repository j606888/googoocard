import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string, studentCardId: string } }) {
  const { id, studentCardId } = await params;

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
  });

  if (!studentCard) {
    return NextResponse.json({ error: "Student card not found" }, { status: 404 });
  }

  if (studentCard.expiredAt) {
    return NextResponse.json({ error: "Student card already expired" }, { status: 400 });
  }

  if (studentCard.studentId !== parseInt(id)) {
    return NextResponse.json({ error: "Student card does not belong to the student" }, { status: 400 });
  }

  await prisma.studentCard.update({
    where: { id: parseInt(studentCardId) },
    data: { expiredAt: new Date() },
  });

  return NextResponse.json({ success: true });
}