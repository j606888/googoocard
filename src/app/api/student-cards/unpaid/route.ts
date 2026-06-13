import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

// Classroom-wide list of unpaid cards, for the owner to see who still owes.
export async function GET() {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = await prisma.studentCard.findMany({
    where: {
      isPaid: false,
      student: { classroomId },
    },
    include: {
      student: { select: { id: true, name: true, avatarUrl: true } },
      card: { select: { name: true } },
      purchasedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cards);
}
