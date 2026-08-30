import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { createStudent } from "@/service/student";
import { toStudentPayload } from "@/service/studentDetail";

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const needsRenewalParam = searchParams.get("needsRenewal");
  const filterNeedsRenewal = needsRenewalParam === "true";
  const sort = searchParams.get("sort") === "number" ? "number" : "name";

  const students = await prisma.student.findMany({
    where: {
      classroomId,
      ...(query
        ? {
            name: {
              contains: query,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filterNeedsRenewal
        ? {
            studentTags: {
              some: { tag: { name: "Needs Renewal", classroomId } },
            },
          }
        : {}),
    },
    orderBy: sort === "number" ? { number: "asc" } : { name: "asc" },
    include: {
      studentCards: {
        where: {
          expiredAt: null,
        },
        include: {
          card: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      studentTags: {
        include: { tag: true },
        orderBy: { createdAt: "asc" },
      },
      danceQualifications: true,
      lessons: {
        include: {
          lesson: { select: { id: true, status: true } },
        },
      },
      // 只取「最近一次已點名的出席」一列（`AttendanceRecord` 有 @@index([studentId])），
      // 桌面版名單要靠它排序／顯示「最近上課」。刻意不拉整份出席史。
      attendanceRecords: {
        where: { lessonPeriod: { attendanceTakenAt: { not: null } } },
        orderBy: { lessonPeriod: { attendanceTakenAt: "desc" } },
        take: 1,
        select: { lessonPeriod: { select: { attendanceTakenAt: true } } },
      },
    },
  });

  const results = students.map((student) => {
    const activeStudentCards = student.studentCards.filter(
      (studentCard) => studentCard.remainingSessions > 0
    );

    const isInActiveLesson = student.lessons.some(
      (ls) => ls.lesson.status === "inProgress"
    );
    const activeLessonIds = student.lessons
      .filter((ls) => ls.lesson.status === "inProgress")
      .map((ls) => ls.lesson.id);

    return {
      // Whitelist, not `...student` — the row carries `lineBindKey` (a LINE
      // account-takeover token) and `lineUserId`. See toStudentPayload.
      ...toStudentPayload(student, { includeShareKey: true }),
      tags: student.studentTags.map((st) => ({ id: st.tag.id, name: st.tag.name })),
      danceQualifications: student.danceQualifications.map((q) => q.danceType),
      isInActiveLesson,
      activeLessonIds,
      lastAttendAt:
        student.attendanceRecords[0]?.lessonPeriod.attendanceTakenAt ?? null,
      studentCards: activeStudentCards.map((studentCard) => ({
        ...studentCard,
        card: studentCard.card,
      })),
    };
  });

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const { name, avatarUrl, note } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const existingStudent = await prisma.student.findFirst({
    where: {
      name,
      classroomId,
    },
  });

  if (existingStudent) {
    return NextResponse.json(
      { error: "Student already exists" },
      { status: 400 }
    );
  }

  const student = await createStudent(classroomId!, { name, avatarUrl, note });

  // A brand-new student has no `lineBindKey` / `lineUserId` yet, so the raw row
  // leaks nothing today — but it's the same shape that leaked before, and it
  // would start leaking silently the day either is set at creation.
  return NextResponse.json(toStudentPayload(student, { includeShareKey: true }));
}
