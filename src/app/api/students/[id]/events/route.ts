import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  // Ran with no auth at all until 2026-08-23.
  const student = await findStudentInClassroom(parseInt(id), classroomId);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Fetch a generous window; we slice to 10 AFTER filtering out stale events.
  const events = await prisma.event.findMany({
    where: { studentId: student.id },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  // Events use loose resourceType/resourceId (no FK/cascade), so an event can
  // outlive its source (e.g. attendance reset/removed, card refunded). Validate
  // each against current state and drop the orphaned/stale ones.
  const attendanceRecordIds = events
    .filter((e) => e.resourceType === "attendanceRecord")
    .map((e) => e.resourceId);
  const studentCardIds = events
    .filter((e) => e.resourceType === "studentCard")
    .map((e) => e.resourceId);

  const [existingRecords, existingCards] = await Promise.all([
    attendanceRecordIds.length
      ? prisma.attendanceRecord.findMany({
          where: { id: { in: attendanceRecordIds } },
          select: { id: true },
        })
      : Promise.resolve([] as { id: number }[]),
    studentCardIds.length
      ? prisma.studentCard.findMany({
          where: { id: { in: studentCardIds } },
          select: { id: true, remainingSessions: true },
        })
      : Promise.resolve([] as { id: number; remainingSessions: number }[]),
  ]);

  const liveRecordIds = new Set(existingRecords.map((r) => r.id));
  const cardById = new Map(existingCards.map((c) => [c.id, c] as const));

  const isLive = (event: (typeof events)[number]) => {
    if (event.resourceType === "attendanceRecord") {
      return liveRecordIds.has(event.resourceId);
    }
    if (event.resourceType === "studentCard") {
      const card = cardById.get(event.resourceId);
      if (!card) return false;
      // "課卡使用完畢" only makes sense while the card is still exhausted.
      if (event.title === "課卡使用完畢") return card.remainingSessions === 0;
      return true;
    }
    return true;
  };

  const liveEvents = events.filter(isLive).slice(0, 10);

  return NextResponse.json(liveEvents);
}
