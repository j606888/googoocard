import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
} from "../factories";

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { POST as checkin } from "@/app/api/liff/checkin/route";
import { GET as today } from "@/app/api/liff/today/route";

function checkinRequest(token: string | null, body: unknown) {
  return new Request("http://test.local/api/liff/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function todayRequest(token: string | null, studentId?: number) {
  const qs = studentId ? `?studentId=${studentId}` : "";
  return new Request(`http://test.local/api/liff/today${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function createPeriod(lessonId: number, start: Date, end: Date) {
  return prisma.lessonPeriod.create({
    data: { lessonId, startTime: start, endTime: end },
  });
}

describe("POST /api/liff/checkin (self check-in)", () => {
  let classroomId: number;
  let studentId: number;
  let cardId: number;
  let lessonId: number;
  let periodId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    const student = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "lineAmy" },
    });
    studentId = student.id;
    const card = await createCard(classroomId, { name: "10 堂卡", sessions: 10 });
    cardId = card.id;
    const { lesson } = await createLesson(classroomId, { cardIds: [cardId] });
    lessonId = lesson.id;
    const now = new Date();
    const period = await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));
    periodId = period.id;
  });

  it("建立 source=STUDENT 紀錄、扣一堂、不設 attendanceTakenAt", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 5, totalSessions: 5 });

    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      periodId,
      status: "checked",
      remainingSessions: 4,
      exhausted: false,
    });

    const record = await prisma.attendanceRecord.findFirst({
      where: { studentId, lessonPeriodId: periodId },
    });
    expect(record?.source).toBe("STUDENT");
    expect(record?.studentCardId).not.toBeNull();

    const period = await prisma.lessonPeriod.findUnique({ where: { id: periodId } });
    expect(period?.attendanceTakenAt).toBeNull();

    const sc = await prisma.studentCard.findFirst({ where: { studentId } });
    expect(sc?.remainingSessions).toBe(4);
  });

  it("用完最後一堂 → exhausted 且建立「課卡使用完畢」Event", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 1, totalSessions: 10 });

    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ status: "checked", remainingSessions: 0, exhausted: true });

    const event = await prisma.event.findFirst({
      where: { studentId, title: "課卡使用完畢" },
    });
    expect(event).not.toBeNull();
  });

  it("沒有可用課卡 → status no_card，紀錄無綁卡、不扣堂", async () => {
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ periodId, status: "no_card" });

    const record = await prisma.attendanceRecord.findFirst({
      where: { studentId, lessonPeriodId: periodId },
    });
    expect(record).not.toBeNull();
    expect(record?.studentCardId).toBeNull();
    expect(record?.source).toBe("STUDENT");
  });

  it("重複簽到同一時段 → already_checked，不重建也不重複扣堂", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 5, totalSessions: 5 });

    await checkin(checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] }));
    const res2 = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    const body2 = await res2.json();
    expect(body2.results[0].status).toBe("already_checked");

    const count = await prisma.attendanceRecord.count({
      where: { studentId, lessonPeriodId: periodId },
    });
    expect(count).toBe(1);
    const sc = await prisma.studentCard.findFirst({ where: { studentId } });
    expect(sc?.remainingSessions).toBe(4); // only the first check-in deducted
  });

  it("帶別人的 studentId（lineUserId 不符）→ 403 forbidden", async () => {
    const res = await checkin(
      checkinRequest("lineSomeoneElse", { studentId, lessonId, periodIds: [periodId] })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("periodIds 為空 → 400", async () => {
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [] })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/liff/today", () => {
  let classroomId: number;
  let studentId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    const student = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "lineAmy" },
    });
    studentId = student.id;
  });

  it("今天有課 → 回 today 清單，含 alreadyChecked 旗標", async () => {
    const { lesson } = await createLesson(classroomId, { name: "今日課" });
    const now = new Date();
    await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));

    const res = await today(todayRequest("lineAmy", studentId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toHaveLength(1);
    expect(body.today[0].lessonName).toBe("今日課");
    expect(body.today[0].periods[0].alreadyChecked).toBe(false);
    expect(body.nextLesson).toBeNull();
  });

  it("今天沒課 → today 空、回 nextLesson", async () => {
    const { lesson } = await createLesson(classroomId, { name: "下週課" });
    const future = new Date(Date.now() + 7 * 24 * 3600_000);
    await createPeriod(lesson.id, future, new Date(future.getTime() + 3600_000));

    const res = await today(todayRequest("lineAmy", studentId));
    const body = await res.json();
    expect(body.today).toHaveLength(0);
    expect(body.nextLesson?.lessonName).toBe("下週課");
  });
});
