import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildStudentDetailPayload } from "@/service/studentDetail";

export async function GET(request: Request, { params }: { params: Promise<{ randomKey: string }> }) {
  const { randomKey } = await params;

  const student = await prisma.student.findUnique({
    where: { randomKey },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const payload = await buildStudentDetailPayload(student.id);
  if (!payload) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
