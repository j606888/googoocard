import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findLessonInClassroom } from "@/lib/authz";
import { toStudentPayload } from "@/service/studentDetail";
import { fetchStudentsWithValidCards } from "@/service/lessonCards";
import { cardStatusFor, type CardStatus } from "@/domains/attendance/rosterInsights";
import { toDanceLevels, type DanceLevels } from "@/domains/qualification";

const ATTENDANCE_STATUS = {
  NOT_STARTED: "not_started",
  ATTENDED: "attended",
  ABSENT: "absent",
} as const;

const EMPTY_CARD_STATUS: CardStatus = {
  usableSessions: 0,
  usableCardCount: 0,
  blockedCardCount: 0,
  otherSessions: 0,
  level: "none",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  // Ran with no auth at all until 2026-08-23 — any lesson's roster and
  // per-period attendance was readable by incrementing the lesson id.
  const scoped = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scoped) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: scoped.id },
    include: {
      danceStyle: { select: { hasLevels: true } },
      students: {
        include: {
          student: true,
        },
      },
      periods: {
        orderBy: {
          startTime: "asc",
        },
        include: {
          attendanceRecords: true,
        },
      },
      cards: {
        select: { cardId: true },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Card status for the whole roster in one query — never inside the map below,
  // which would be an N+1 over the class. `classroomId` is the lesson's own, so
  // a student from another classroom can never be read through this lesson id.
  const rosterIds = lesson.students.map((lessonStudent) => lessonStudent.studentId);
  const validCardIds = lesson.cards.map((lessonCard) => lessonCard.cardId);
  const withCards = await fetchStudentsWithValidCards(
    rosterIds,
    validCardIds,
    lesson.classroomId
  );

  // Sessions on cards this lesson does NOT accept, one grouped query for the
  // roster — only to word "no card" honestly, never to charge them here.
  const otherCardSums = await prisma.studentCard.groupBy({
    by: ["studentId"],
    where: {
      studentId: { in: rosterIds },
      student: { classroomId: lesson.classroomId },
      cardId: { notIn: validCardIds },
      remainingSessions: { gt: 0 },
      expiredAt: null,
    },
    _sum: { remainingSessions: true },
  });
  const otherSessionsByStudent = new Map(
    otherCardSums.map((row) => [row.studentId, row._sum.remainingSessions ?? 0])
  );

  const cardStatusByStudent = new Map<number, CardStatus>();
  const qualificationsByStudent = new Map<number, number[]>();
  const levelsByStudent = new Map<number, DanceLevels>();
  for (const student of withCards) {
    const levels = toDanceLevels(student.danceQualifications);
    qualificationsByStudent.set(
      student.id,
      student.danceQualifications.flatMap((q) => (q.danceStyleId === null ? [] : [q.danceStyleId]))
    );
    levelsByStudent.set(student.id, levels);
    cardStatusByStudent.set(
      student.id,
      cardStatusFor(
        student.studentCards,
        levels,
        lesson,
        otherSessionsByStudent.get(student.id) ?? 0
      )
    );
  }

  const students = lesson.students.map((lessonStudent) => {
    const student = lessonStudent.student;
    const attendances = lesson.periods.map((period) => {
      let attendanceStatus: "not_started" | "attended" | "absent" = ATTENDANCE_STATUS.NOT_STARTED

      if (period.attendanceTakenAt) {
        const record = period.attendanceRecords.find(
          (record) => record.studentId === student.id
        );
        attendanceStatus = record ? ATTENDANCE_STATUS.ATTENDED : ATTENDANCE_STATUS.ABSENT;
      }

      return {
        // `LessonPeriod` has only an index on (lessonId, startTime), no unique —
        // two periods can share a start time, so the client joins on this id
        // rather than on the timestamp.
        periodId: period.id,
        startTime: period.startTime,
        attendanceStatus,
      }
    });

    // Whitelist, not `...student` — the roster only needs identity, and the
    // row carries `lineBindKey` / `randomKey`. See toStudentPayload.
    return {
      ...toStudentPayload(student),
      attendances,
      cardStatus: cardStatusByStudent.get(student.id) ?? {
        ...EMPTY_CARD_STATUS,
        otherSessions: otherSessionsByStudent.get(student.id) ?? 0,
      },
      danceQualifications: qualificationsByStudent.get(student.id) ?? [],
      danceLevels: levelsByStudent.get(student.id) ?? {},
    };
  });

  return NextResponse.json(students);
}
