import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";
import { conversionLinksInclude, toStudentPayload } from "@/service/studentDetail";
import { DEFAULT_DANCE_LEVEL, isValidDanceLevel } from "@/lib/danceLevels";
import { toDanceLevels } from "@/domains/qualification";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, note, avatarUrl, danceQualifications, danceLevels } = await request.json();
  const { classroomId } = await decodeAuthToken();

  // The duplicate-name check below is classroom-scoped, but the update itself
  // was not — a student id from another classroom was fully editable.
  const target = await findStudentInClassroom(parseInt(id), classroomId);
  if (!target) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // `danceLevels` ({ [danceStyleId]: 2, ... }) is the current shape; the older
  // `danceQualifications` (danceStyleId[]) is still accepted from pre-level
  // clients: it adds new dance styles at 初階 but keeps an existing row's level,
  // so a stale tab can't silently downgrade a 中階 student.
  // Either way it is authoritative: dance styles left out lose the qualification.
  // A `null` level = keep the existing level (初階 when newly created).
  let levels: [number, number | null][] | undefined;
  if (danceLevels !== undefined) {
    if (
      danceLevels === null ||
      typeof danceLevels !== "object" ||
      Array.isArray(danceLevels) ||
      Object.values(danceLevels).some((level) => !isValidDanceLevel(level))
    ) {
      return NextResponse.json({ error: "Invalid dance levels" }, { status: 400 });
    }
    levels = Object.entries(danceLevels as Record<string, number>).map(
      ([styleId, level]) => [Number(styleId), level]
    );
  } else if (danceQualifications !== undefined) {
    if (!Array.isArray(danceQualifications)) {
      return NextResponse.json({ error: "Invalid dance qualifications" }, { status: 400 });
    }
    levels = danceQualifications.map((styleId) => [Number(styleId), null]);
  }

  // Every style id must be one of this classroom's — otherwise a student
  // could be qualified for another classroom's style.
  if (levels !== undefined) {
    const styleIds = levels.map(([styleId]) => styleId);
    const owned =
      styleIds.every((styleId) => Number.isInteger(styleId) && styleId > 0) &&
      (await prisma.danceStyle.count({ where: { id: { in: styleIds }, classroomId } })) ===
        new Set(styleIds).size;
    if (!owned) {
      return NextResponse.json({ error: "DANCE_STYLE_NOT_FOUND" }, { status: 400 });
    }
  }

  const existingStudent = await prisma.student.findFirst({
    where: {
      name,
      classroomId,
      NOT: {
        id: parseInt(id),
      },
    },
  });

  if (existingStudent) {
    return NextResponse.json({ error: "學生姓名已存在，請換一個名字" }, { status: 400 });
  }

  try {
    const student = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { id: parseInt(id) },
        data: { name, note, avatarUrl },
      });

      if (levels !== undefined) {
        await tx.studentDanceQualification.deleteMany({
          where: {
            studentId: student.id,
            // Rows the backfill hasn't reached (null style) go too: the client
            // only ever sees, and sends back, style ids.
            OR: [
              { danceStyleId: null },
              { danceStyleId: { notIn: levels.map(([danceStyleId]) => danceStyleId) } },
            ],
          },
        });
        for (const [danceStyleId, level] of levels) {
          await tx.studentDanceQualification.upsert({
            where: { studentId_danceStyleId: { studentId: student.id, danceStyleId } },
            create: { studentId: student.id, danceStyleId, level: level ?? DEFAULT_DANCE_LEVEL },
            update: level === null ? {} : { level },
          });
        }
      }

      return student;
    });

    // Never `NextResponse.json(student)` — the raw row carries `lineBindKey`
    // and `lineUserId`. The share key stays, since this is the teacher-facing
    // detail page and its `Student` type declares `randomKey`.
    return NextResponse.json(toStudentPayload(student, { includeShareKey: true }));
  } catch (error) {
    console.error("Failed to update student", error);
    return NextResponse.json({ error: "更新失敗，請稍後再試" }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findFirst({
    // Scoped to the caller's classroom: this handler used to run with no auth
    // at all, exposing every student's full profile by incrementing the id.
    where: { id: parseInt(id), classroomId },
    include: {
      lessons: true,
      // NOT `classroom: true` — that row carries `checkinKey`, the classroom's
      // walk-in QR self check-in secret.
      classroom: { select: { id: true, name: true } },
      studentTags: {
        include: { tag: true },
        orderBy: { createdAt: "asc" },
      },
      // Ordered and joined to their style so pages without a teacher session
      // (LIFF, the public share link) can label them without /api/dance-styles.
      danceQualifications: {
        include: { danceStyle: { select: danceStyleSummarySelect } },
        orderBy: { danceStyle: { sortOrder: "asc" } },
      },
      studentCards: {
        include: {
          card: { include: { danceStyle: { select: danceStyleSummarySelect } } },
          ...conversionLinksInclude,
          purchasedBy: { select: { name: true } },
          paidBy: { select: { name: true } },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      attendanceRecords: {
        include: {
          lessonPeriod: true,
          studentCard: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }
    }
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const lastAttendance = await prisma.attendanceRecord.findFirst({
    where: {
      studentId: parseInt(id),
    },
    include: {
      lessonPeriod: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const { attendanceRecords, studentCards, studentTags, danceQualifications } = student;
  const tags = studentTags.map((st) => ({ id: st.tag.id, name: st.tag.name }));

  // 轉換而來的卡不是「買」的 — 它繼承舊卡的剩餘價值，計進去會把消費金額灌水。
  const purchasedCards = studentCards.filter((card) => card.origin === "PURCHASE");

  const overview = {
    lastAttendAt: lastAttendance?.lessonPeriod.attendanceTakenAt,
    attendLessonCount: student.lessons.length,
    cardCount: purchasedCards.length,
    totalSpend: purchasedCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: purchasedCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  }



  const attendLessonIds = [...new Set(attendanceRecords.map((record) => record.lessonPeriod.lessonId))]
  const lessons = await prisma.lesson.findMany({
    where: {
      id: {
        in: attendLessonIds,
      },
    },
    include: {
      periods: {
        orderBy: {
          startTime: "asc",
        },
      }
    }
  })

  const attendancesByLesson = lessons.map((lesson) => {
    return {
      lessonId: lesson.id,
      lessonName: lesson.name,
      totalPeriods: lesson.periods.length,
      lessonPeriodIds: lesson.periods.map((period) => period.id),
      studentAttendances: lesson.periods.map((period) => {
        return {
          studentAttend: false,
          periodId: period.id,
          periodStartTime: period.startTime,
          periodAttendantCheck: !!period.attendanceTakenAt
        }
      }),
      attendances: [] as {
        periodStartTime: Date;
        periodNumber: number;
        totalPeriods: number;
      }[],
    }
  })

  const attendancesByDate = {} as {
    [dateKey: string]: {
      date: number;
      attendances: {
        lessonName: string;
        periodNumber: number;
        totalPeriods: number
      }[]
    }
  }

  // Create a map to group attendance records by student card
  const studentCardAttendances = new Map<
    number,
    Array<{ lessonName: string; periodStartTime: Date }>
  >()

  attendanceRecords.forEach((record) => {
    const lessonId = record.lessonPeriod.lessonId;
    const lessonPeriodId = record.lessonPeriod.id;
    const periodStartTime = record.lessonPeriod.startTime;

    const lesson = lessons.find((lesson) => lesson.id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    const attendanceData = {
      periodStartTime,
      periodNumber: lesson.periods.findIndex((period) => period.id === lessonPeriodId) + 1,
      totalPeriods: lesson.periods.length,
    }
    attendancesByLesson.find((lesson) => lesson.lessonId === lessonId)?.attendances.push(attendanceData);
    const studentAttendance = attendancesByLesson.find((lesson) => lesson.lessonId === lessonId)?.studentAttendances.find((attendance) => attendance.periodId === lessonPeriodId);
    if (studentAttendance) {
      studentAttendance.studentAttend = true
    }

    // Group attendance records by student card
    if (record.studentCardId) {
      const cardAttendances = studentCardAttendances.get(record.studentCardId) || [];
      cardAttendances.push({
        lessonName: lesson.name,
        periodStartTime,
      });
      studentCardAttendances.set(record.studentCardId, cardAttendances);
    }
  })

  // Create enhanced student cards with attendance records
  const studentCardsWithAttendances = studentCards.map(card => ({
    ...card,
    attendanceRecords: studentCardAttendances.get(card.id) || []
  }))

  attendancesByLesson.forEach((lesson) => {
    lesson.attendances.forEach((attendance) => {
      const dateKey = formatDate(attendance.periodStartTime.getTime());
      if (!attendancesByDate[dateKey]) {
        attendancesByDate[dateKey] = {
          date: attendance.periodStartTime.getTime(),
          attendances: [
            {
              lessonName: lesson.lessonName,
              periodNumber: attendance.periodNumber,
              totalPeriods: lesson.totalPeriods,
            }
          ],
        }
      } else {
        attendancesByDate[dateKey].attendances.push({
          lessonName: lesson.lessonName,
          periodNumber: attendance.periodNumber,
          totalPeriods: lesson.totalPeriods,
        })
      }
    })
  })

  const sortedAttendancesByDate = Object.values(attendancesByDate).sort((a, b) => b.date - a.date);

  return NextResponse.json({
    overview,
    attendancesByDate: sortedAttendancesByDate,
    attendancesByLesson,
    studentCards: studentCardsWithAttendances,
    tags,
    danceQualifications: danceQualifications.flatMap((q) => (q.danceStyleId === null ? [] : [q.danceStyleId])),
    danceLevels: toDanceLevels(danceQualifications),
    qualifiedDanceStyles: danceQualifications.flatMap((q) => (q.danceStyle ? [q.danceStyle] : [])),
    classroom: student.classroom,
    // Teacher-facing, so the share-link token is included — but `lineBindKey`
    // and `lineUserId` never are. See toStudentPayload.
    ...toStudentPayload(student, { includeShareKey: true }),
  });
}
