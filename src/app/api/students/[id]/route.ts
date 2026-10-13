import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";
import {
  attendanceCounts,
  attendanceHistoryInclude,
  buildAttendanceViews,
  conversionLinksInclude,
  toLastAttendance,
  toStudentPayload,
} from "@/service/studentDetail";
import { DEFAULT_DANCE_LEVEL, isValidDanceLevel } from "@/lib/danceLevels";
import { toDanceLevels } from "@/domains/qualification";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, note, avatarUrl, danceQualifications, danceLevels, archived } = await request.json();
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
  if (archived !== undefined && typeof archived !== "boolean") {
    return NextResponse.json({ error: "Invalid archived" }, { status: 400 });
  }

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

  // 只改封存狀態（「封存學生」／「還原」）時不帶 name，跳過改名的重名檢查。
  const existingStudent = name === undefined ? null : await prisma.student.findFirst({
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
        data: {
          name,
          note,
          avatarUrl,
          ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
        },
      });

      if (levels !== undefined) {
        await tx.studentDanceQualification.deleteMany({
          where: {
            studentId: student.id,
            danceStyleId: { notIn: levels.map(([danceStyleId]) => danceStyleId) },
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
      attendanceRecords: attendanceHistoryInclude,
    }
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { attendanceRecords, studentCards, studentTags, danceQualifications } = student;
  const tags = studentTags.map((st) => ({ id: st.tag.id, name: st.tag.name }));

  // 轉換而來的卡不是「買」的 — 它繼承舊卡的剩餘價值，計進去會把消費金額灌水。
  const purchasedCards = studentCards.filter((card) => card.origin === "PURCHASE");

  const overview = {
    ...toLastAttendance(attendanceRecords),
    ...attendanceCounts(attendanceRecords),
    cardCount: purchasedCards.length,
    totalSpend: purchasedCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: purchasedCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  };

  const { attendancesByLesson, attendancesByDate, studentCardAttendances } =
    await buildAttendanceViews(attendanceRecords);

  const studentCardsWithAttendances = studentCards.map((card) => ({
    ...card,
    attendanceRecords: studentCardAttendances.get(card.id) ?? [],
  }));

  return NextResponse.json({
    overview,
    attendancesByDate,
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
