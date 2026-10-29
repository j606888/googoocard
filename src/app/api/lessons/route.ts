import { decodeAuthToken } from "@/lib/auth";
import { DraftLesson } from "@/store/slices/lessons";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshLesson, summarizeLessonPeriods } from "@/service/lesson";
import { cardMatchesLesson } from "@/domains/qualification";
import { DEFAULT_DANCE_LEVEL, isValidDanceLevel } from "@/lib/danceLevels";
import {
  DEFAULT_LESSON_KIND,
  DEFAULT_SESSIONS_PER_ATTENDANCE,
  isValidLessonKind,
  isValidSessionsPerAttendance,
  isValidDropInPrice,
} from "@/lib/lessonKind";
import {
  allTeachersInClassroom,
  findDanceStyleInClassroom,
  findLessonGroupInClassroom,
  findLocationInClassroom,
} from "@/lib/authz";
import { teacherSummarySelect } from "@/lib/teachers";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";
import { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { classroomId } = await decodeAuthToken();
  const tab = searchParams.get("tab") ?? "inProgress";
  const sort = searchParams.get("sort") ?? "name";
  const search = searchParams.get("search")?.trim() ?? "";
  const danceStyleIdParam = searchParams.get("danceStyleId");
  const groupIdParam = searchParams.get("groupId");
  const locationIdParam = searchParams.get("locationId");
  const pageParam = searchParams.get("page");

  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const danceStyleId = danceStyleIdParam ? parseInt(danceStyleIdParam, 10) : undefined;
  // "none" asks for the virtual 未分類 bucket (groupId IS NULL); a numeric id
  // scopes to one LessonGroup's members; omitted means no group filter at all.
  const groupId =
    groupIdParam === "none" ? null : groupIdParam !== null ? parseInt(groupIdParam, 10) : undefined;

  const locationId = locationIdParam ? parseInt(locationIdParam, 10) : undefined;

  // Shared filter (search + danceStyleId + groupId + locationId) applied to both the listing
  // and tabsCount, so the tab counts reflect what the user is currently
  // filtering by (including "just this group"'s lessons).
  const filterWhere: Prisma.LessonWhereInput = {
    classroomId,
    ...(danceStyleId && !Number.isNaN(danceStyleId) ? { danceStyleId } : {}),
    ...(groupId !== undefined && !Number.isNaN(groupId as number) ? { groupId } : {}),
    ...(locationId && !Number.isNaN(locationId) ? { locationId } : {}),
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

  // tab="all" (used by the group-detail view, which has no status tabs of its
  // own) skips the status filter instead of matching a literal "all" status.
  const lessons = await prisma.lesson.findMany({
    where: { ...filterWhere, ...(tab !== "all" ? { status: tab } : {}) },
    orderBy,
    include: {
      danceStyle: { select: danceStyleSummarySelect },
      location: { select: locationSummarySelect },
      periods: true,
      teachers: { include: { teacher: { select: teacherSummarySelect } } },
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
      nextSessionEndTime,
      nextSessionPeriodId,
      dueForAttendanceCount,
      dueForAttendancePeriodId,
      dueForAttendanceDate,
      dueForAttendanceEndTime,
      dueForAttendanceIsBacklog,
      firstPeriodStart,
      lastPeriodStart,
      lastPeriodEnd,
    } = summarizeLessonPeriods(lesson.periods, now);

    return {
      id: lesson.id,
      name: lesson.name,
      danceStyleId: lesson.danceStyleId,
      danceStyle: lesson.danceStyle,
      level: lesson.level,
      status: lesson.status,
      kind: lesson.kind,
      endedAt: lesson.endedAt,
      sessionsPerAttendance: lesson.sessionsPerAttendance,
      dropInPrice: lesson.dropInPrice,
      studentCount: lesson._count.students,
      teachers: lesson.teachers.map((t) => t.teacher),
      cardIds: lesson.cards.map((c) => c.cardId),
      groupId: lesson.groupId,
      location: lesson.location,
      totalPeriods,
      attendedCount,
      nextSessionDate,
      nextSessionEndTime,
      nextSessionPeriodId,
      dueForAttendanceCount,
      dueForAttendancePeriodId,
      dueForAttendanceDate,
      dueForAttendanceEndTime,
      dueForAttendanceIsBacklog,
      firstPeriodStart,
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

  // Dance styles that actually have lessons in this classroom, so the filter
  // chips never offer a dead-end (0-result) option. Classroom-wide + unfiltered
  // so the set stays stable across tab/search/danceStyleId changes.
  const distinctDanceStyles = await prisma.lesson.findMany({
    where: { classroomId },
    distinct: ["danceStyleId"],
    select: { danceStyleId: true },
  });
  const availableDanceStyleIds = distinctDanceStyles.map((d) => d.danceStyleId);
  // Same for the 分部 chips.
  const distinctLocations = await prisma.lesson.findMany({
    where: { classroomId, locationId: { not: null } },
    distinct: ["locationId"],
    select: { locationId: true },
  });
  const availableLocationIds = distinctLocations.map((d) => d.locationId!);

  return NextResponse.json({
    lessons: summaries,
    tabsCount,
    hasNextPage,
    availableDanceStyleIds,
    availableLocationIds,
  });
}

export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
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
  if (draftLesson.dropInPrice !== undefined && !isValidDropInPrice(draftLesson.dropInPrice)) {
    return NextResponse.json({ error: "Invalid dropInPrice" }, { status: 400 });
  }

  // A groupId is caller-controlled input — verify it names a group in this
  // classroom before attaching it (same IDOR guard as findLessonInClassroom),
  // or a bogus/foreign id either 500s on the FK or silently links to another
  // classroom's group.
  // The dance style is caller-controlled too: it must be one of this
  // classroom's, or a lesson could borrow another classroom's style.
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

  const cards = await prisma.card.findMany({
    where: { id: { in: draftLesson.cardIds } },
  });
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

  const lesson = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        name: draftLesson.lessonName,
        classroomId: classroomId!,
        status: "inProgress",
        danceStyleId: draftLesson.danceStyleId,
        level: draftLesson.level ?? DEFAULT_DANCE_LEVEL,
        kind: draftLesson.kind ?? DEFAULT_LESSON_KIND,
        sessionsPerAttendance: draftLesson.sessionsPerAttendance ?? DEFAULT_SESSIONS_PER_ATTENDANCE,
        dropInPrice: draftLesson.dropInPrice ?? null,
        groupId: draftLesson.groupId ?? null,
        locationId: draftLesson.locationId ?? null,
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