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

import { GET } from "@/app/api/income/daily-summary/list/route";

// 一個已點名的時段，一位學生扣一格 `price` 元的卡（單格價 = price）。
async function takenPeriod(
  classroomId: number,
  startTime: string,
  price: number,
  locationId: number | null = null
) {
  const { lesson } = await createLesson(classroomId, { locationId });
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId: lesson.id,
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000),
      attendanceTakenAt: new Date(startTime),
    },
  });
  const student = await createStudent(classroomId, { name: `S${period.id}` });
  const card = await createCard(classroomId);
  const studentCard = await createStudentCard(student.id, card.id, {
    finalPrice: price,
    totalSessions: 1,
  });
  await prisma.attendanceRecord.create({
    data: { lessonPeriodId: period.id, studentId: student.id, studentCardId: studentCard.id },
  });
}

function call(locationId?: number | string) {
  const query = locationId === undefined ? "" : `?locationId=${locationId}`;
  return GET(new Request(`http://test.local/api/income/daily-summary/list${query}`));
}

describe("GET /api/income/daily-summary/list", () => {
  let classroomId: number;
  let tainanId: number;
  let kaohsiungId: number;

  // 台北時間 6/1：台南 300 + 高雄 500 + 未指定 200；6/2：高雄 100。
  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    tainanId = (await createLocation(classroomId, { name: "台南" })).id;
    kaohsiungId = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
    await takenPeriod(classroomId, "2026-06-01T02:00:00Z", 300, tainanId);
    await takenPeriod(classroomId, "2026-06-01T03:00:00Z", 500, kaohsiungId);
    await takenPeriod(classroomId, "2026-06-01T04:00:00Z", 200);
    await takenPeriod(classroomId, "2026-06-02T02:00:00Z", 100, kaohsiungId);
  });

  it("沒帶 locationId → 全教室每天的加總，新的在前", async () => {
    const body = await (await call()).json();
    expect(body.days).toEqual([
      { date: "2026-06-02", totalRevenue: 100 },
      { date: "2026-06-01", totalRevenue: 1000 },
    ]);
    expect(body.years).toEqual([2026]);
  });

  it("?locationId=<id> → 只算那個分部的課", async () => {
    expect((await (await call(kaohsiungId)).json()).days).toEqual([
      { date: "2026-06-02", totalRevenue: 100 },
      { date: "2026-06-01", totalRevenue: 500 },
    ]);
    expect((await (await call(tainanId)).json()).days).toEqual([
      { date: "2026-06-01", totalRevenue: 300 },
    ]);
  });

  it("?locationId=none → 只算沒指定分部的課", async () => {
    expect((await (await call("none")).json()).days).toEqual([
      { date: "2026-06-01", totalRevenue: 200 },
    ]);
  });

  it("locationId 格式不對 → 400", async () => {
    for (const bad of ["abc", "0", "-1", "1.5", "", "99999999999"]) {
      expect((await call(bad)).status).toBe(400);
    }
  });

  it("跨教室隔離：別間教室的收入不會出現，帶它的分部 id 也拿不到", async () => {
    const other = await createClassroom({ email: "other@test.local" });
    const otherLocation = await createLocation(other.id, { name: "台北" });
    await takenPeriod(other.id, "2026-06-01T02:00:00Z", 9000, otherLocation.id);
    await takenPeriod(other.id, "2026-06-03T02:00:00Z", 7000);

    expect((await (await call()).json()).days).toEqual([
      { date: "2026-06-02", totalRevenue: 100 },
      { date: "2026-06-01", totalRevenue: 1000 },
    ]);
    expect((await (await call(otherLocation.id)).json()).days).toEqual([]);
    expect((await (await call("none")).json()).days).toEqual([
      { date: "2026-06-01", totalRevenue: 200 },
    ]);
  });
});
