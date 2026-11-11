import { Prisma } from "@prisma/client";
import { resolveDropInInput } from "@/lib/dropInOptions";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import {
  allTeachersInClassroom,
  findDanceStyleInClassroom,
  findLessonInClassroom,
  findLessonGroupInClassroom,
  findLocationInClassroom,
} from "@/lib/authz";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";
import { teacherSummarySelect } from "@/lib/teachers";
import { DraftLesson } from "@/store/slices/lessons";
import { toStudentPayload } from "@/service/studentDetail";
import { cardMatchesLesson } from "@/domains/qualification";
import { isValidDanceLevel } from "@/lib/danceLevels";
import { isValidLessonKind, isValidSessionsPerAttendance } from "@/lib/lessonKind";
import { refreshLesson } from "@/service/lesson";
import { resolveAssistantIds } from "@/service/lessonAssistants";
import { isFinanceEnabled } from "@/service/finance/access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  // PUT/DELETE in this file were scoped in commit 00cf407; GET was left
  // unauthenticated, exposing any lesson's roster, teachers and cards.
  const scoped = await findLessonInClassroom(parseInt(id), classroomId);
  if (!scoped) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: scoped.id },
    include: {
      danceStyle: { select: danceStyleSummarySelect },
      periods: {
        orderBy: {
          startTime: "asc",
        },
      },
      students: {
        include: {
          student: true,
        },
      },
      teachers: {
        include: {
          teacher: { select: teacherSummarySelect },
        },
      },
      assistants: { select: { teacher: { select: teacherSummarySelect } }, orderBy: { id: "asc" } },
      cards: {
        include: {
          card: { include: { danceStyle: { select: danceStyleSummarySelect } } },
        },
      },
      group: {
        select: { id: true, name: true },
      },
      location: { select: locationSummarySelect },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const result = {
    ...lesson,
    // Whitelist — the raw Student row carries `lineBindKey`. See toStudentPayload.
    students: lesson.students.map((student) => toStudentPayload(student.student)),
    teachers: lesson.teachers.map((teacher) => teacher.teacher),
    assistants: lesson.assistants.map((assistant) => assistant.teacher),
    cards: lesson.cards.map((card) => card.card),
  };

  return NextResponse.json(result);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  if (!(await findLessonInClassroom(parseInt(id), classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  const draftLesson = await request.json() as DraftLesson;

  if (draftLesson.level !== undefined && !isValidDanceLevel(draftLesson.level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (draftLesson.kind !== undefined && !isValidLessonKind(draftLesson.kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (
    draftLesson.sessionsPerAttendance !== undefined &&
    !isValidSessionsPerAttendance(draftLesson.sessionsPerAttendance)
  ) {
    return NextResponse.json({ error: "Invalid sessionsPerAttendance" }, { status: 400 });
  }
  const dropIn = resolveDropInInput(draftLesson);
  if (dropIn === "invalid") {
    return NextResponse.json({ error: "Invalid dropInPrice" }, { status: 400 });
  }

  if (typeof draftLesson.danceStyleId !== "number") {
    return NextResponse.json({ error: "DANCE_STYLE_REQUIRED" }, { status: 400 });
  }
  if (!(await findDanceStyleInClassroom(draftLesson.danceStyleId, classroomId))) {
    return NextResponse.json({ error: "DANCE_STYLE_NOT_FOUND" }, { status: 400 });
  }
  // teacherIds are caller-controlled too — another classroom's teacher must not
  // be attachable (or show up on that teacher's page).
  if (
    !Array.isArray(draftLesson.teacherIds) ||
    !(await allTeachersInClassroom(draftLesson.teacherIds, classroomId))
  ) {
    return NextResponse.json({ error: "TEACHER_NOT_FOUND" }, { status: 400 });
  }
  // 小幫手也是本教室的 Teacher，而且不能同時是這門課的老師。
  const assistantIds = await resolveAssistantIds(draftLesson, classroomId);
  if ("error" in assistantIds) {
    return NextResponse.json({ error: assistantIds.error }, { status: 400 });
  }

  if (
    draftLesson.groupId != null &&
    !(await findLessonGroupInClassroom(draftLesson.groupId, classroomId))
  ) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (
    draftLesson.locationId != null &&
    !(await findLocationInClassroom(draftLesson.locationId, classroomId))
  ) {
    return NextResponse.json({ error: "LOCATION_NOT_FOUND" }, { status: 400 });
  }

  if (draftLesson.locationId == null && (await isFinanceEnabled(classroomId!))) {
    return NextResponse.json({ error: "LOCATION_REQUIRED", code: "LOCATION_REQUIRED" }, { status: 400 });
  }

  const cards = await prisma.card.findMany({
    where: { id: { in: draftLesson.cardIds } },
  });
  // 系統的「贈送卡」卡種不掛在課上（它什麼課都能用，由 issueGiftCardInTx 發）。
  if (cards.some((card) => card.isGift)) {
    return NextResponse.json(
      { error: "GIFT_CARD_NOT_SELLABLE", code: "GIFT_CARD_NOT_SELLABLE" },
      { status: 400 }
    );
  }
  const mismatchedCards = cards.filter(
    (card) => !cardMatchesLesson(card, draftLesson.danceStyleId)
  );
  if (mismatchedCards.length > 0) {
    return NextResponse.json(
      {
        error: "PRACTICE_CARD_DANCE_TYPE_MISMATCH",
        cardNames: mismatchedCards.map((card) => card.name),
      },
      { status: 400 }
    );
  }

  const lesson = await prisma.lesson.update({
    where: { id: parseInt(id) },
    data: {
      name: draftLesson.lessonName,
      danceStyleId: draftLesson.danceStyleId,
      level: draftLesson.level,
      kind: draftLesson.kind,
      sessionsPerAttendance: draftLesson.sessionsPerAttendance,
      dropInPrice: dropIn.dropInPrice,
      dropInOptions:
        dropIn.dropInOptions === undefined ? undefined : (dropIn.dropInOptions ?? Prisma.DbNull),
      groupId: draftLesson.groupId ?? null,
      locationId: draftLesson.locationId ?? null,
    },
  });

  await prisma.lessonTeacher.deleteMany({
    where: { lessonId: parseInt(id) },
  });
  await prisma.lessonTeacher.createMany({
    data: draftLesson.teacherIds.map((teacherId) => ({ teacherId, lessonId: parseInt(id) })),
  });

  // 沒送 assistantIds = 不動小幫手；只把剛變成老師的人從小幫手拿掉（老師優先）。
  await prisma.lessonAssistant.deleteMany({
    where: {
      lessonId: parseInt(id),
      ...(assistantIds.ids === undefined ? { teacherId: { in: draftLesson.teacherIds } } : {}),
    },
  });
  if (assistantIds.ids) {
    await prisma.lessonAssistant.createMany({
      data: assistantIds.ids.map((teacherId) => ({ teacherId, lessonId: parseInt(id) })),
    });
  }

  await prisma.lessonCard.deleteMany({
    where: { lessonId: parseInt(id) },
  });
  await prisma.lessonCard.createMany({
    data: draftLesson.cardIds.map((cardId) => ({ cardId, lessonId: parseInt(id) })),
  });

  // Switching kind can move the lesson between 進行中 and 已結束.
  await refreshLesson(lesson.id);
  return NextResponse.json(lesson);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();
  const lessonId = parseInt(id);
  if (!(await findLessonInClassroom(lessonId, classroomId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // 分帳規則跟著刪（外鍵是 RESTRICT）；有時段的課照舊刪不掉，整筆 rollback。
  await prisma.$transaction([
    prisma.lessonTeacher.deleteMany({ where: { lessonId } }),
    prisma.lessonAssistant.deleteMany({ where: { lessonId } }),
    prisma.lessonCard.deleteMany({ where: { lessonId } }),
    prisma.lessonStudent.deleteMany({ where: { lessonId } }),
    prisma.lessonSplitRule.deleteMany({ where: { lessonId } }),
    prisma.lesson.delete({ where: { id: lessonId } }),
  ]);

  return NextResponse.json({});
}