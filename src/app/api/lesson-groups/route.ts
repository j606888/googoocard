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
    include: {
      lessons: {
        where: { classroomId },
        select: {
          id: true,
          location: { select: { name: true } },
          teachers: { select: { teacher: { select: { name: true } } }, orderBy: { id: "asc" } },
          periods: { select: { startTime: true }, orderBy: { startTime: "asc" }, take: 1 },
        },
      },
    },
  });

  return NextResponse.json(
    groups.map((group) => {
      // 最近一期＝跟「第幾期」同一套排法（termNumbers）的最後一個：照開始日，沒排時段的算最新。
      const startOf = (l: (typeof group.lessons)[number]) => l.periods[0]?.startTime.getTime() ?? Infinity;
      const latest = [...group.lessons].sort((a, b) => startOf(a) - startOf(b) || a.id - b.id).at(-1);
      return {
        id: group.id,
        name: group.name,
        lessonCount: group.lessons.length,
        latestTerm: latest
          ? {
              lessonId: latest.id,
              locationName: latest.location?.name ?? null,
              teacherNames: latest.teachers.map((t) => t.teacher.name),
              firstStart: latest.periods[0]?.startTime.toISOString() ?? null,
            }
          : null,
      };
    })
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
