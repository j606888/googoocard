import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.lessonGroup.findMany({
    where: { classroomId },
    orderBy: { name: "asc" },
    include: { _count: { select: { lessons: true } } },
  });

  return NextResponse.json(
    groups.map((group) => ({
      id: group.id,
      name: group.name,
      lessonCount: group._count.lessons,
    }))
  );
}

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  // Upsert on the (name, classroomId) unique key — matches the Tag creation
  // pattern (students/[id]/tags), so re-typing an existing group's name just
  // returns it instead of erroring.
  const group = await prisma.lessonGroup.upsert({
    where: { name_classroomId: { name: name.trim(), classroomId } },
    create: { name: name.trim(), classroomId },
    update: {},
  });

  return NextResponse.json(group);
}
