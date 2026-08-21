import prisma from "@/lib/prisma";
import { DanceType, LessonPeriod, StudentCardOrigin } from "@prisma/client";
import { createStudent as createStudentWithNumber } from "@/service/student";

// Wipe all tables between tests (FK-safe via CASCADE).
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AttendanceRecord", "LessonStudent", "LessonPeriod", "LessonTeacher",
      "LessonCard", "StudentDanceQualification", "StudentTag", "Tag", "Event",
      "StudentCard", "Lesson", "LessonGroup", "Card", "Student", "Teacher", "InviteToken",
      "Membership", "Classroom", "User", "LineAccount" RESTART IDENTITY CASCADE`
  );
}

export async function createClassroom() {
  const user = await prisma.user.create({
    data: { email: "owner@test.local", name: "Owner", password: "x" },
  });
  return prisma.classroom.create({
    data: { ownerId: user.id, name: "Test Classroom" },
  });
}

export async function createStudent(
  classroomId: number,
  {
    name = "Student",
    qualifications = [],
  }: { name?: string; qualifications?: DanceType[] } = {}
) {
  const student = await createStudentWithNumber(classroomId, {
    name,
    avatarUrl: "/images/avatar_1.png",
  });
  if (qualifications.length > 0) {
    await prisma.studentDanceQualification.createMany({
      data: qualifications.map((danceType) => ({
        studentId: student.id,
        danceType,
      })),
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
    danceType = null,
  }: {
    name?: string;
    price?: number;
    sessions?: number;
    isPracticeCard?: boolean;
    danceType?: DanceType | null;
  } = {}
) {
  return prisma.card.create({
    data: { name, price, sessions, classroomId, isPracticeCard, danceType },
  });
}

export async function createLessonGroup(classroomId: number, name = "Group") {
  return prisma.lessonGroup.create({ data: { name, classroomId } });
}

export async function createLesson(
  classroomId: number,
  {
    name = "Lesson",
    danceType = DanceType.BACHATA,
    cardIds = [],
    withPeriod = false,
    groupId = null,
  }: {
    name?: string;
    danceType?: DanceType;
    cardIds?: number[];
    withPeriod?: boolean;
    groupId?: number | null;
  } = {}
) {
  const lesson = await prisma.lesson.create({
    data: { name, classroomId, danceType, status: "inProgress", groupId },
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
  return prisma.studentCard.create({
    data: {
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
  });
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
