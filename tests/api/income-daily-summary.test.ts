import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  createLocation,
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
    locationId = null,
    startTime,
    records,
  }: {
    lessonName?: string;
    locationId?: number | null;
    startTime: string;
    records: Array<{
      studentName: string;
      card: { finalPrice: number; totalSessions: number } | null;
    }>;
  }
) {
  const { lesson } = await createLesson(classroomId, { name: lessonName, locationId });
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

function getRequest(date?: string, locationId?: number | string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (locationId !== undefined) params.set("locationId", String(locationId));
  const query = params.toString();
  return new Request(`http://test.local/api/income/daily-summary${query ? `?${query}` : ""}`, {
    method: "GET",
  });
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

  describe("分部", () => {
    let tainanId: number;
    let kaohsiungId: number;

    // 6/1：台南 500、高雄 1000、未指定分部 250。6/10：只有台南。
    beforeEach(async () => {
      tainanId = (await createLocation(classroomId, { name: "台南" })).id;
      kaohsiungId = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
      await createTakenPeriod(classroomId, {
        lessonName: "台南課",
        locationId: tainanId,
        startTime: "2026-06-01T02:00:00Z",
        records: [{ studentName: "A", card: { finalPrice: 3000, totalSessions: 6 } }],
      });
      await createTakenPeriod(classroomId, {
        lessonName: "高雄課",
        locationId: kaohsiungId,
        startTime: "2026-06-01T03:00:00Z",
        records: [{ studentName: "B", card: { finalPrice: 6000, totalSessions: 6 } }],
      });
      await createTakenPeriod(classroomId, {
        lessonName: "沒分部的課",
        startTime: "2026-06-01T04:00:00Z",
        records: [{ studentName: "C", card: { finalPrice: 1500, totalSessions: 6 } }],
      });
      await createTakenPeriod(classroomId, {
        lessonName: "台南課 6/10",
        locationId: tainanId,
        startTime: "2026-06-10T02:00:00Z",
        records: [{ studentName: "D", card: { finalPrice: 3000, totalSessions: 6 } }],
      });
    });

    it("每個時段帶出 location（只有 id、name；沒指定是 null）", async () => {
      const body = await (await GET(getRequest("2026-06-01"))).json();
      expect(body.totalRevenue).toBe(1750);
      expect(body.periods.map((p: { location: unknown }) => p.location)).toEqual([
        { id: tainanId, name: "台南" },
        { id: kaohsiungId, name: "高雄" },
        null,
      ]);
    });

    it("回應不夾帶整列 lesson／student", async () => {
      const body = await (await GET(getRequest("2026-06-01"))).json();
      expect(Object.keys(body.periods[0]).sort()).toEqual(
        [
          "attendanceCount",
          "lessonId",
          "lessonName",
          "location",
          "pendingStudents",
          "periodId",
          "revenue",
          "sessionsPerAttendance",
          "termEnrolledCount",
          "termRevenue",
        ].sort()
      );
    });

    it("?locationId=<id> → 只有那個分部的時段", async () => {
      const body = await (await GET(getRequest("2026-06-01", kaohsiungId))).json();
      expect(body.periods).toHaveLength(1);
      expect(body.periods[0].lessonName).toBe("高雄課");
      expect(body.totalRevenue).toBe(1000);
    });

    it("?locationId=none → 只有沒指定分部的時段", async () => {
      const body = await (await GET(getRequest("2026-06-01", "none"))).json();
      expect(body.periods).toHaveLength(1);
      expect(body.periods[0].lessonName).toBe("沒分部的課");
      expect(body.totalRevenue).toBe(250);
    });

    it("無 date ＋ locationId → 預設日期是那個分部最近一次已點名的日子", async () => {
      const body = await (await GET(getRequest(undefined, kaohsiungId))).json();
      expect(body.selectedDate).toBe("2026-06-01");
      expect(body.periods.map((p: { lessonName: string }) => p.lessonName)).toEqual(["高雄課"]);
    });

    it("locationId 格式不對 → 400", async () => {
      for (const bad of ["abc", "0", "-3", "2.5", "99999999999"]) {
        const res = await GET(getRequest("2026-06-01", bad));
        expect(res.status).toBe(400);
      }
    });

    it("跨教室隔離：帶別間教室的分部 id 拿不到任何時段", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other-loc@test.local", name: "Other", password: "x" },
      });
      const otherClassroom = await prisma.classroom.create({
        data: { ownerId: otherUser.id, name: "Other Classroom" },
      });
      const otherLocation = await createLocation(otherClassroom.id, { name: "台北" });
      await createTakenPeriod(otherClassroom.id, {
        lessonName: "別人的課",
        locationId: otherLocation.id,
        startTime: "2026-06-01T02:00:00Z",
        records: [{ studentName: "別人", card: { finalPrice: 9000, totalSessions: 6 } }],
      });
      await createTakenPeriod(otherClassroom.id, {
        lessonName: "別人沒分部的課",
        startTime: "2026-06-01T02:00:00Z",
        records: [{ studentName: "別人2", card: { finalPrice: 9000, totalSessions: 6 } }],
      });

      const filtered = await (await GET(getRequest("2026-06-01", otherLocation.id))).json();
      expect(filtered.periods).toEqual([]);
      expect(filtered.totalRevenue).toBe(0);

      const none = await (await GET(getRequest("2026-06-01", "none"))).json();
      expect(none.periods.map((p: { lessonName: string }) => p.lessonName)).toEqual(["沒分部的課"]);
    });
  });
});
