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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { name, price, sessions } = await request.json();

  const card = await prisma.card.update({
    where: { id: Number(id) },
    data: {
      name,
      price,
      sessions,
    },
  });

  return NextResponse.json(card);
}
