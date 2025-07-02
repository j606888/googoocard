import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.update({
    where: { id: Number(id), classroomId },
    data: { expiredAt: null },
  });

  return NextResponse.json(card);
}
