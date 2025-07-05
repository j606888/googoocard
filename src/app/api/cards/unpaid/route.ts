import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unpaidStudentCards = await prisma.studentCard.findMany({
    where: {
      card: {
        classroomId,
      },
      paid: false,
    },
    include: {
      student: true,
      card: true,
    }
  })

  return NextResponse.json(unpaidStudentCards);
}