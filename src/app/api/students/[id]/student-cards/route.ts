import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = await params;

  const studentCards = await prisma.studentCard.findMany({
    where: {
      studentId: parseInt(id),
    },
  });

  return NextResponse.json(studentCards);
}