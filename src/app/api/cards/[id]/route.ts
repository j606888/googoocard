import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.delete({
    where: { id: Number(id), classroomId },
  });

  return NextResponse.json(card);
}
