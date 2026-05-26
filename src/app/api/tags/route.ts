import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();
  const tags = await prisma.tag.findMany({
    where: { classroomId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}
