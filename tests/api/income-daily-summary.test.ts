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

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/income/daily-summary/route";

// 建立一個「已點名」的時段並附上出席紀錄。
// records: 每筆給 finalPrice/totalSessions 代表扣了某張卡；null 代表未扣卡(pending)。
async function createTakenPeriod(
  classroomId: number,
  {
    lessonName = "Lesson",
    startTime,
    records,
  }: {
    lessonName?: string;
    startTime: string;
    records: Array<{
      studentName: string;
      card: { finalPrice: number; totalSessions: number } | null;
    }>;
  }
) {
  const { lesson } = await createLesson(classroomId, { name: lessonName });
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId: lesson.id,
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000),
      attendanceTakenAt: new Date(startTime),
    },
  });

  for (const r of records) {
    const student = await createStudent(classroomId, { name: r.studentName });
    let studentCardId: number | null = null;
    if (r.card) {
      const card = await createCard(classroomId);
      const sc = await createStudentCard(student.id, card.id, {
        finalPrice: r.card.finalPrice,
        totalSessions: r.card.totalSessions,
      });
      studentCardId = sc.id;
    }
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: student.id, studentCardId },
    });
  }
  return period;
}

function getRequest(date?: string) {
  const url = date
    ? `http://test.local/api/income/daily-summary?date=${date}`
    : "http://test.local/api/income/daily-summary";
  return new Request(url, { method: "GET" });
}

describe("GET /api/income/daily-summary", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("沒有任何已點名時段 → 空結果", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ selectedDate: "", totalRevenue: 0, periods: [] });
  });

  it("指定日期 → 加總當天每堂單堂價為 totalRevenue", async () => {
    await createTakenPeriod(classroomId, {
      lessonName: "早上 Bachata",
      startTime: "2026-06-01T02:00:00Z", // 台北 10:00
      records: [
        { studentName: "A", card: { finalPrice: 3000, totalSessions: 6 } }, // 500
        { studentName: "B", card: { finalPrice: 1500, totalSessions: 6 } }, // 250
      ],
    });

    const res = await GET(getRequest("2026-06-01"));
    const body = await res.json();
    expect(body.selectedDate).toBe("2026-06-01");
    expect(body.totalRevenue).toBe(750);
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].attendanceCount).toBe(2);
    expect(body.periods[0].revenue).toBe(750);
  });

  it("未扣卡學生 → 列入 pendingStudents 且不計營收", async () => {
    await createTakenPeriod(classroomId, {
      startTime: "2026-06-01T02:00:00Z",
      records: [
        { studentName: "已扣卡", card: { finalPrice: 3000, totalSessions: 6 } },
        { studentName: "待處理", card: null },
      ],
    });

    const res = await GET(getRequest("2026-06-01"));
    const body = await res.json();
    expect(body.totalRevenue).toBe(500); // 只算扣卡的那位
    expect(body.periods[0].attendanceCount).toBe(2);
    expect(body.periods[0].pendingStudents).toEqual(["待處理"]);
  });

  it("只回傳指定日期的時段（不同台北日期被排除）", async () => {
    await createTakenPeriod(classroomId, {
      lessonName: "6/1",
      startTime: "2026-06-01T02:00:00Z", // 台北 6/1 10:00
      records: [{ studentName: "A", card: { finalPrice: 3000, totalSessions: 6 } }],
    });
    await createTakenPeriod(classroomId, {
      lessonName: "6/2",
      startTime: "2026-06-01T17:00:00Z", // 台北 6/2 01:00
      records: [{ studentName: "B", card: { finalPrice: 6000, totalSessions: 6 } }],
    });

    const res = await GET(getRequest("2026-06-01"));
    const body = await res.json();
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].lessonName).toBe("6/1");
    expect(body.totalRevenue).toBe(500);
  });

  it("尚未點名的時段 (attendanceTakenAt 為 null) 不計入", async () => {
    const { lesson } = await createLesson(classroomId, { name: "未點名" });
    await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date("2026-06-01T02:00:00Z"),
        endTime: new Date("2026-06-01T03:00:00Z"),
        attendanceTakenAt: null,
      },
    });

    const res = await GET(getRequest("2026-06-01"));
    const body = await res.json();
    expect(body.periods).toHaveLength(0);
    expect(body.totalRevenue).toBe(0);
  });

  it("無 date 參數 → 預設用最近一個已點名時段的台北日期", async () => {
    await createTakenPeriod(classroomId, {
      lessonName: "舊",
      startTime: "2026-06-01T02:00:00Z",
      records: [{ studentName: "A", card: { finalPrice: 3000, totalSessions: 6 } }],
    });
    await createTakenPeriod(classroomId, {
      lessonName: "新",
      startTime: "2026-06-10T02:00:00Z", // 台北 6/10
      records: [{ studentName: "B", card: { finalPrice: 6000, totalSessions: 6 } }],
    });

    const res = await GET(getRequest());
    const body = await res.json();
    expect(body.selectedDate).toBe("2026-06-10");
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].lessonName).toBe("新");
  });

  it("跨教室隔離：只計算自己教室的時段", async () => {
    // 別的教室也有一個同日已點名時段
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    await createTakenPeriod(otherClassroom.id, {
      startTime: "2026-06-01T02:00:00Z",
      records: [{ studentName: "別人", card: { finalPrice: 9000, totalSessions: 6 } }],
    });

    await createTakenPeriod(classroomId, {
      startTime: "2026-06-01T02:00:00Z",
      records: [{ studentName: "我的", card: { finalPrice: 3000, totalSessions: 6 } }],
    });

    const res = await GET(getRequest("2026-06-01"));
    const body = await res.json();
    expect(body.periods).toHaveLength(1);
    expect(body.totalRevenue).toBe(500);
  });
});
