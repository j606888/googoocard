import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  createLesson,
  createStudent,
  createStudentCard,
  routeParams,
} from "../factories";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: mockAuth }));

import { GET } from "@/app/api/lessons/[id]/period-stats/route";

const request = (id: number) =>
  GET(new Request(`http://test/api/lessons/${id}/period-stats`), routeParams({ id: String(id) }));

async function addPeriod(lessonId: number, start: string, taken = true) {
  const startTime = new Date(start);
  return prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? startTime : null,
    },
  });
}

describe("GET /api/lessons/:id/period-stats", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    mockAuth.mockResolvedValue({ userId: classroom.ownerId, classroomId, role: "owner" });
  });

  it("reports headcount and revenue per taken period, and skips periods not taken yet", async () => {
    const { lesson } = await createLesson(classroomId);
    const first = await addPeriod(lesson.id, "2026-10-01T11:30:00Z");
    const second = await addPeriod(lesson.id, "2026-10-08T11:30:00Z");
    const pending = await addPeriod(lesson.id, "2026-10-15T11:30:00Z", false);
    const card = await createCard(classroomId);
    const a = await createStudent(classroomId, { name: "A" });
    const b = await createStudent(classroomId, { name: "B" });
    const c = await createStudent(classroomId, { name: "C" });
    const cardA = await createStudentCard(a.id, card.id, { finalPrice: 2000, totalSessions: 6 });
    const cardB = await createStudentCard(b.id, card.id, { finalPrice: 2000, totalSessions: 6 });

    for (const [period, student, studentCardId] of [
      [first, a, cardA.id],
      [second, a, cardA.id],
      [second, b, cardB.id],
    ] as const) {
      await prisma.attendanceRecord.create({
        data: { lessonPeriodId: period.id, studentId: student.id, studentCardId },
      });
    }
    // 沒綁卡：算人頭、不算收入。扣兩格與單堂費照 periodRevenue。
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: first.id, studentId: c.id } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: second.id, studentId: c.id, dropInCharge: { create: { amount: 400 } } },
    });
    // 自助簽到、老師還沒定案的時段不算。
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: pending.id, studentId: a.id, studentCardId: cardA.id, source: "STUDENT" },
    });

    const response = await request(lesson.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      periods: [
        { periodId: first.id, attendeeCount: 2, revenue: 333 },
        { periodId: second.id, attendeeCount: 3, revenue: 1067 },
      ],
      // 333.33 + 1066.67 = 1400，不是 333 + 1067。
      totalRevenue: 1400,
    });
  });

  it("returns 404 for another classroom's lesson", async () => {
    const other = (await createClassroom({ name: "Other", email: "other@test.local" })).id;
    const { lesson: foreign } = await createLesson(other);
    await addPeriod(foreign.id, "2026-10-01T11:30:00Z");
    expect((await request(foreign.id)).status).toBe(404);
  });
});
