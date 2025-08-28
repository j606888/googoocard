import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const events = await prisma.event.findMany({
    where: { studentId: parseInt(id) },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return NextResponse.json(events);
}