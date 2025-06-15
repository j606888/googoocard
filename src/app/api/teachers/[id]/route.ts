
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { classroomId } = await decodeAuthToken();
  const { id } = params;

  const teacher = await prisma.teacher.delete({
    where: { id: +id, classroomId },
  });

  return NextResponse.json(teacher);
}