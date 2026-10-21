import prisma from "@/lib/prisma";
import { LessonPeriod, StudentCardOrigin } from "@prisma/client";
import { createStudent as createStudentWithNumber } from "@/service/student";
import { nextCardSerial } from "@/service/studentCardSerial";

// Wipe all tables between tests (FK-safe via CASCADE).
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AttendanceRecord", "LessonStudent", "LessonPeriod", "LessonTeacher",
      "LessonCard", "StudentDanceQualification", "StudentTag", "Tag", "Event",
      "StudentCard", "Lesson", "LessonGroup", "Card", "DanceStyle", "Student", "Teacher", "InviteToken",
      "Membership", "Classroom", "User", "LineAccount", "RenewalReminder", "PushToken", "WebPushSubscription",
      "NotificationPreference" RESTART IDENTITY CASCADE`
  );
}

/**
 * A classroom plus its owner's `Membership`.
 *
 * The membership is not optional set dressing: `apiRoute` re-reads it on every
 * request (see src/lib/apiRoute.ts), so a classroom without one answers 401 to
 * everything. Tests mock `decodeAuthToken` to return `userId: 1`, and `resetDb`
 * truncates with RESTART IDENTITY, so the first user created is id 1 — pass
 * `ownerUserId` when a test needs the membership to belong to someone else.
 */
export async function createClassroom({
  name = "Test Classroom",
  email = "owner@test.local",
  ownerUserId,
}: { name?: string; email?: string; ownerUserId?: number } = {}) {
  const user = ownerUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } })
    : await prisma.user.create({
        data: { email, name: "Owner", password: "x" },
      });
  const classroom = await prisma.classroom.create({
    data: { ownerId: user.id, name },
  });
  await prisma.membership.create({
    data: { userId: user.id, classroomId: classroom.id, role: "owner" },
  });
  return classroom;
}

/** A second User in an existing classroom — an 助教 unless told otherwise. */
export async function createMember(
  classroomId: number,
  { email = "member@test.local", name = "Member", role = "assistant" } = {}
) {
  const user = await prisma.user.create({ data: { email, name, password: "x" } });
  await prisma.membership.create({ data: { userId: user.id, classroomId, role } });
  return user;
}

export async function createStudent(
  classroomId: number,
  {
    name = "Student",
    qualifications = [],
    levels = {},
  }: {
    name?: string;
    /** Dance style ids the student has completed (level 1). */
    qualifications?: number[];
    /** Completed level per dance style id; takes the place of `qualifications` (level 1). */
    levels?: Record<number, number>;
  } = {}
) {
  const student = await createStudentWithNumber(classroomId, {
    name,
    avatarUrl: "/images/avatars/not-sure.png",
  });
  const rows = [
    ...qualifications.map((danceStyleId) => ({ danceStyleId, level: 1 })),
    ...Object.entries(levels).map(([danceStyleId, level]) => ({
      danceStyleId: Number(danceStyleId),
      level,
    })),
  ];
  if (rows.length > 0) {
    await prisma.studentDanceQualification.createMany({
      data: rows.map((row) => ({ studentId: student.id, ...row })),
    });
  }
  return student;
}

export async function createCard(
  classroomId: number,
  {
    name = "Card",
    price = 3000,
    sessions = 6,
    isPracticeCard = false,
    danceStyleId = null,
  }: {
    name?: string;
    price?: number;
    sessions?: number;
    isPracticeCard?: boolean;
    danceStyleId?: number | null;
  } = {}
) {
  return prisma.card.create({
    data: { name, price, sessions, classroomId, isPracticeCard, danceStyleId },
  });
}

export async function createDanceStyle(
  classroomId: number,
  {
    name = "Bachata",
    color = "green",
    hasLevels = false,
    sortOrder = 0,
    archivedAt = null,
  }: {
    name?: string;
    color?: string;
    hasLevels?: boolean;
    sortOrder?: number;
    archivedAt?: Date | null;
  } = {}
) {
  return prisma.danceStyle.create({
    data: { classroomId, name, color, hasLevels, sortOrder, archivedAt },
  });
}

/**
 * The five styles every classroom had under the old enum, keyed by the old
 * enum name so tests read the same. Hustle is the levelled one, as in production.
 */
export type DanceStyleIds = Record<"BACHATA" | "SALSA" | "ZOUK" | "HUSTLE" | "KIZOMBA", number>;

export async function createDanceStyles(classroomId: number): Promise<DanceStyleIds> {
  const specs = [
    ["BACHATA", "Bachata", "green", false],
    ["SALSA", "Salsa", "orange", false],
    ["ZOUK", "Zouk", "slate", false],
    ["HUSTLE", "Hustle", "stone", true],
    ["KIZOMBA", "Kizomba", "purple", false],
  ] as const;
  const ids = {} as DanceStyleIds;
  for (const [index, [key, name, color, hasLevels]] of specs.entries()) {
    ids[key] = (
      await createDanceStyle(classroomId, { name, color, hasLevels, sortOrder: index })
    ).id;
  }
  return ids;
}

/** The classroom's "Bachata" style, created on first use — for tests that need
 * a lesson but don't care about its style. */
export async function defaultDanceStyle(classroomId: number) {
  return prisma.danceStyle.upsert({
    where: { classroomId_name: { classroomId, name: "Bachata" } },
    create: { classroomId, name: "Bachata", color: "green" },
    update: {},
  });
}

export async function createLessonGroup(classroomId: number, name = "Group") {
  return prisma.lessonGroup.create({ data: { name, classroomId } });
}

export async function createLesson(
  classroomId: number,
  {
    name = "Lesson",
    danceStyleId,
    cardIds = [],
    withPeriod = false,
    groupId = null,
    level = 1,
    kind = "fixed",
  }: {
    name?: string;
    kind?: "fixed" | "ongoing";
    /** Omitted: the classroom's default "Bachata" style (created on first use). */
    danceStyleId?: number;
    level?: number;
    cardIds?: number[];
    withPeriod?: boolean;
    groupId?: number | null;
  } = {}
) {
  const lesson = await prisma.lesson.create({
    data: {
      name,
      classroomId,
      danceStyleId: danceStyleId ?? (await defaultDanceStyle(classroomId)).id,
      level,
      kind,
      status: "inProgress",
      groupId,
    },
  });
  if (cardIds.length > 0) {
    await prisma.lessonCard.createMany({
      data: cardIds.map((cardId) => ({ cardId, lessonId: lesson.id })),
    });
  }
  let period: LessonPeriod | null = null;
  if (withPeriod) {
    period = await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T10:00:00Z"),
        endTime: new Date("2026-06-01T11:00:00Z"),
      },
    });
  }
  return { lesson, period };
}

export async function createStudentCard(
  studentId: number,
  cardId: number,
  {
    remainingSessions = 6,
    totalSessions = 6,
    finalPrice = 3000,
    isPaid,
    createdAt,
    origin,
    note,
  }: {
    remainingSessions?: number;
    totalSessions?: number;
    finalPrice?: number;
    isPaid?: boolean;
    createdAt?: Date; // 課卡營收依購買時間分月,測試需要指定
    origin?: StudentCardOrigin; // CONVERSION 的卡不計入課卡營收
    note?: string;
  } = {}
) {
  // 跟正式的建卡路徑一樣從教室計數器發號，測試裡的編號才會是連號。
  const { classroomId } = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { classroomId: true },
  });
  return prisma.$transaction(async (tx) =>
    tx.studentCard.create({
      data: {
        serialNumber: await nextCardSerial(tx, classroomId),
        studentId,
        cardId,
        basePrice: finalPrice,
        finalPrice,
        totalSessions,
        remainingSessions,
        ...(isPaid === undefined ? {} : { isPaid }),
        ...(createdAt === undefined ? {} : { createdAt }),
        ...(origin === undefined ? {} : { origin }),
        ...(note === undefined ? {} : { note }),
      },
    })
  );
}

// Pending attendance record (no card consumed yet) — what the attendance GET
// endpoint classifies into uncheckedType.
export async function createPendingAttendance(
  lessonPeriodId: number,
  studentId: number
) {
  return prisma.attendanceRecord.create({
    data: { lessonPeriodId, studentId, studentCardId: null },
  });
}

export function jsonRequest(method: string, body?: unknown) {
  return new Request("http://test.local/api", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}
