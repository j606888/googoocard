import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

// Mark a previously-unpaid StudentCard as paid, recording WHO confirmed it
// (often a different person than who opened the card — e.g. assistant opens,
// owner confirms after receiving cash).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentCardId: string }> }
) {
  const { id, studentCardId } = await params;
  const { userId } = await decodeAuthToken();

  const studentCard = await prisma.studentCard.findUnique({
    where: { id: parseInt(studentCardId) },
    include: { card: true },
  });

  if (!studentCard) {
    return NextResponse.json({ error: "Student card not found" }, { status: 404 });
  }

  if (studentCard.studentId !== parseInt(id)) {
    return NextResponse.json(
      { error: "Student card does not belong to the student" },
      { status: 400 }
    );
  }

  if (studentCard.isPaid) {
    return NextResponse.json({ error: "ALREADY_PAID" }, { status: 400 });
  }

  const updated = await prisma.studentCard.update({
    where: { id: studentCard.id },
    data: {
      isPaid: true,
      paidAt: new Date(),
      paidByUserId: userId ?? null,
    },
  });

  await prisma.event.create({
    data: {
      title: "確認付款",
      description: `確認付款 ${studentCard.card.name}（$${studentCard.finalPrice}）`,
      studentId: parseInt(id),
      resourceType: "studentCard",
      resourceId: studentCard.id,
    },
  });

  return NextResponse.json(updated);
}
