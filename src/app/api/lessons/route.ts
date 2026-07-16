import { decodeAuthToken } from "@/lib/auth";
import { DraftLesson } from "@/store/slices/lessons";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson, summarizeLessonPeriods } from "@/service/lesson";
import { cardMatchesLesson } from "@/domains/qualification";
import { DanceType, Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { classroomId } = await decodeAuthToken();
  const tab = searchParams.get("tab") ?? "inProgress";
  const sort = searchParams.get("sort") ?? "name";
  const search = searchParams.get("search")?.trim() ?? "";
  const danceTypeParam = searchParams.get("danceType");
  const pageParam = searchParams.get("page");

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const danceType =
    danceTypeParam && danceTypeParam in DanceType
      ? (danceTypeParam as DanceType)
      : undefined;

  // Shared filter (search + danceType) applied to both the listing and tabsCount,
  // so the tab counts reflect what the user is currently filtering by.
  const filterWhere: Prisma.LessonWhereInput = {
    classroomId,
    ...(danceType ? { danceType } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              teachers: {
                some: { teacher: { name: { contains: search, mode: "insensitive" } } },
              },
            },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "name" ? { name: "asc" as const } : { endAt: "desc" as const };

  const lessons = await prisma.lesson.findMany({
    where: { ...filterWhere, status: tab },
    orderBy,
    include: {
      periods: true,
      teachers: { include: { teacher: { select: { id: true, name: true } } } },
      cards: { select: { cardId: true } },
      _count: { select: { students: true } },
    },
  });

  const now = new Date();
  let summaries = lessons.map((lesson) => {
    const {
      totalPeriods,
      attendedCount,
      nextSessionDate,
      nextSessionPeriodId,
      dueForAttendanceCount,
      dueForAttendancePeriodId,
      dueForAttendanceDate,
      lastPeriodStart,
      lastPeriodEnd,
    } = summarizeLessonPeriods(lesson.periods, now);

    return {
      id: lesson.id,
      name: lesson.name,
      danceType: lesson.danceType,
      status: lesson.status,
      studentCount: lesson._count.students,
      teachers: lesson.teachers.map((t) => t.teacher),
      cardIds: lesson.cards.map((c) => c.cardId),
      totalPeriods,
      attendedCount,
      nextSessionDate,
      nextSessionPeriodId,
      dueForAttendanceCount,
      dueForAttendancePeriodId,
      dueForAttendanceDate,
      lastPeriodStart,
      lastPeriodEnd,
    };
  });

  // "Next session" ordering can't be expressed in a Prisma orderBy (it's derived
  // from periods), so sort the mapped summaries: soonest upcoming first, lessons
  // with no upcoming session last.
  if (sort === "nextSession") {
    summaries = summaries.sort((a, b) => {
      const at = a.nextSessionDate?.getTime() ?? Infinity;
      const bt = b.nextSessionDate?.getTime() ?? Infinity;
      return at - bt;
    });
  }

  // Pagination is opt-in: only when `page` is provided (the lessons list uses it
  // for "Load more"). Other consumers omit it and get the full filtered set.
  let hasNextPage = false;
  if (pageParam !== null) {
    const page = Math.max(1, Number(pageParam) || 1);
    const pageSize = DEFAULT_PAGE_SIZE;
    const end = page * pageSize;
    hasNextPage = summaries.length > end;
    summaries = summaries.slice(0, end);
  }

  const tabsCount = {
    inProgress: await prisma.lesson.count({
      where: { ...filterWhere, status: "inProgress" },
    }),
    finished: await prisma.lesson.count({
      where: { ...filterWhere, status: "finished" },
    }),
  };

  // Dance types that actually have lessons in this classroom, so the filter
  // chips never offer a dead-end (0-result) option. Classroom-wide + unfiltered
  // so the set stays stable across tab/search/danceType changes.
  const distinctDanceTypes = await prisma.lesson.findMany({
    where: { classroomId },
    distinct: ["danceType"],
    select: { danceType: true },
  });
  const availableDanceTypes = distinctDanceTypes.map((d) => d.danceType);

  return NextResponse.json({
    lessons: summaries,
    tabsCount,
    hasNextPage,
    availableDanceTypes,
  });
}

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  const draftLesson = await request.json() as DraftLesson;

  const cards = await prisma.card.findMany({
    where: { id: { in: draftLesson.cardIds } },
  });
  const mismatchedCards = cards.filter(
    (card) => !cardMatchesLesson(card, draftLesson.danceType)
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

  const lesson = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        name: draftLesson.lessonName,
        classroomId: classroomId!,
        status: "inProgress",
        danceType: draftLesson.danceType,
      },
    });

    await tx.lessonTeacher.createMany({
      data: draftLesson.teacherIds.map((teacherId) => ({
        teacherId,
        lessonId: lesson.id,
      })),
    });

    await tx.lessonCard.createMany({
      data: draftLesson.cardIds.map((cardId) => ({
        cardId,
        lessonId: lesson.id,
      })),
    });

    if (draftLesson.periods) {
    await tx.lessonPeriod.createMany({
      data: draftLesson.periods.map((period) => ({
        lessonId: lesson.id,
          startTime: new Date(period.startTime),
          endTime: new Date(period.endTime),
        })),
      });
    }

    return lesson
  });

  await refreshLesson(lesson.id);

  return NextResponse.json({ message: "Lesson created" });
}