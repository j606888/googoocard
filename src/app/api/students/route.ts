import { toDanceLevels } from "@/domains/qualification";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { createStudent } from "@/service/student";
import { lastAttendanceQuery, toLastAttendance, toStudentPayload } from "@/service/studentDetail";
import { parseCardSerial } from "@/lib/cardSerial";
import { subDays } from "date-fns";

/**
 * 名單的「近 8 週出席」方格要的出席時間往回取幾天。比 8 週多抓一週：
 * 週在前端依瀏覽器時區切（同 `weeklyCounts`），伺服器這邊只要確定不漏。
 */
const RECENT_ATTEND_LOOKBACK_DAYS = 63;

export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const needsRenewalParam = searchParams.get("needsRenewal");
  const filterNeedsRenewal = needsRenewalParam === "true";
  const sort = searchParams.get("sort") === "number" ? "number" : "name";
  const serialNumber = query ? parseCardSerial(query) : null;
  // 預設只列在籍學生；`?archived=1` 反過來只列封存的（名單底部的「已封存」）。
  const archived = searchParams.get("archived") === "1";

  const students = await prisma.student.findMany({
    where: {
      classroomId,
      archivedAt: archived ? { not: null } : null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              // 搜尋框打「A0412」/「#a0412」也能找到持有這張卡的學生
              // （含已結束的卡 —— 老師常拿舊收據上的卡號來查）。
              ...(serialNumber !== null
                ? [{ studentCards: { some: { serialNumber } } }]
                : []),
            ],
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
      // 只取「最近一次出席」一列（`AttendanceRecord` 有 @@index([studentId])），
      // 名單要靠它排序／顯示「最近上課」。刻意不拉整份出席史。
      attendanceRecords: lastAttendanceQuery,
      // 「未付款」快篩：上面的 studentCards 只帶有效卡，用完或停用的卡
      // 照樣可能還沒付錢（跟 /api/student-cards/unpaid 同一個定義）。
      _count: { select: { studentCards: { where: { isPaid: false } } } },
    },
  });

  // 點名名單要標「未付 $X」和「新學員」：未付款合計、和買過非體驗卡的學生
  // （舊生，src/service/trial.ts）。各一個 groupBy，不必把整份卡拉回來。
  const studentIds = students.map((s) => s.id);
  const [unpaidSums, returningRows, recentRecords] = await Promise.all([
    prisma.studentCard.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, isPaid: false },
      _sum: { finalPrice: true },
    }),
    prisma.studentCard.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, card: { isTrial: false } },
    }),
    // 名單的「近 8 週出席」：只拉時間，不拉整份出席史。
    prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: studentIds },
        lessonPeriod: { startTime: { gte: subDays(new Date(), RECENT_ATTEND_LOOKBACK_DAYS) } },
      },
      select: { studentId: true, lessonPeriod: { select: { startTime: true } } },
    }),
  ]);
  const unpaidByStudent = new Map(unpaidSums.map((r) => [r.studentId, r._sum.finalPrice ?? 0]));
  const returningIds = new Set(returningRows.map((r) => r.studentId));
  const recentAttendByStudent = new Map<number, Date[]>();
  for (const record of recentRecords) {
    const list = recentAttendByStudent.get(record.studentId) ?? [];
    list.push(record.lessonPeriod.startTime);
    recentAttendByStudent.set(record.studentId, list);
  }

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
      danceQualifications: student.danceQualifications.flatMap((q) => (q.danceStyleId === null ? [] : [q.danceStyleId])),
      danceLevels: toDanceLevels(student.danceQualifications),
      isInActiveLesson,
      activeLessonIds,
      ...toLastAttendance(student.attendanceRecords),
      hasUnpaidCard: student._count.studentCards > 0,
      unpaidAmount: unpaidByStudent.get(student.id) ?? 0,
      isNewStudent: !returningIds.has(student.id),
      recentAttendAt: recentAttendByStudent.get(student.id) ?? [],
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
