import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  createDanceStyle,
  createLocation,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/income/session-monthly/[month]/route";

let classroomId: number;

// One taken period of `danceStyleId` at `startTime`, attended by one student
// charged one session of a `finalPrice` / `totalSessions` card.
async function takenPeriod(
  danceStyleId: number,
  startTime: string,
  card: { finalPrice: number; totalSessions: number } | null,
  {
    taken = true,
    locationId = null,
    inClassroomId = classroomId,
  }: { taken?: boolean; locationId?: number | null; inClassroomId?: number } = {}
) {
  const { lesson } = await createLesson(inClassroomId, { danceStyleId, locationId });
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId: lesson.id,
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? new Date(startTime) : null,
    },
  });
  const student = await createStudent(inClassroomId, { name: `S${period.id}` });
  let studentCardId: number | null = null;
  if (card) {
    const c = await createCard(inClassroomId);
    studentCardId = (await createStudentCard(student.id, c.id, card)).id;
  }
  await prisma.attendanceRecord.create({
    data: { lessonPeriodId: period.id, studentId: student.id, studentCardId },
  });
}

function call(month: string, locationId?: number | string) {
  const query = locationId === undefined ? "" : `?locationId=${locationId}`;
  return GET(
    new Request(`http://test.local/api/income/session-monthly/${month}${query}`),
    routeParams({ month })
  );
}

describe("GET /api/income/session-monthly/[month]", () => {
  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("sums the month's taken periods per dance style, largest first", async () => {
    const bachata = await createDanceStyle(classroomId, { name: "Bachata" });
    const kizomba = await createDanceStyle(classroomId, { name: "Kizomba" });
    await takenPeriod(bachata.id, "2026-10-01T11:30:00Z", { finalPrice: 2000, totalSessions: 6 });
    await takenPeriod(bachata.id, "2026-10-08T11:30:00Z", { finalPrice: 2000, totalSessions: 6 });
    await takenPeriod(kizomba.id, "2026-10-01T11:30:00Z", { finalPrice: 300, totalSessions: 3 });
    // Not counted: another month, an untaken period, a record with no card.
    await takenPeriod(kizomba.id, "2026-09-30T11:30:00Z", { finalPrice: 900, totalSessions: 1 });
    await takenPeriod(kizomba.id, "2026-10-15T11:30:00Z", { finalPrice: 900, totalSessions: 1 }, { taken: false });
    await takenPeriod(kizomba.id, "2026-10-08T11:30:00Z", null);

    const body = await (await call("2026-10")).json();

    expect(body.byDanceStyle.map((s: { danceStyle: { name: string } }) => s.danceStyle.name)).toEqual([
      "Bachata",
      "Kizomba",
    ]);
    expect(body.byDanceStyle[0].revenue).toBeCloseTo(4000 / 6);
    expect(body.byDanceStyle[1].revenue).toBeCloseTo(100);
    expect(body.totalRevenue).toBeCloseTo(4000 / 6 + 100);
  });

  it("rejects a malformed month", async () => {
    expect((await call("2026-13")).status).toBe(400);
  });

  describe("分部", () => {
    let styleId: number;
    let tainanId: number;
    let kaohsiungId: number;

    // 台南 300、高雄 500 + 100、未指定分部 200 → 全教室 1100。
    beforeEach(async () => {
      styleId = (await createDanceStyle(classroomId, { name: "Bachata" })).id;
      tainanId = (await createLocation(classroomId, { name: "台南" })).id;
      kaohsiungId = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
      await takenPeriod(styleId, "2026-10-01T11:30:00Z", { finalPrice: 300, totalSessions: 1 }, { locationId: tainanId });
      await takenPeriod(styleId, "2026-10-02T11:30:00Z", { finalPrice: 500, totalSessions: 1 }, { locationId: kaohsiungId });
      await takenPeriod(styleId, "2026-10-03T11:30:00Z", { finalPrice: 100, totalSessions: 1 }, { locationId: kaohsiungId });
      await takenPeriod(styleId, "2026-10-04T11:30:00Z", { finalPrice: 200, totalSessions: 1 });
    });

    it("byLocation: per-location revenue, largest first, no location = null", async () => {
      const body = await (await call("2026-10")).json();

      expect(body.byLocation).toEqual([
        { location: { id: kaohsiungId, name: "高雄" }, revenue: 600 },
        { location: { id: tainanId, name: "台南" }, revenue: 300 },
        { location: null, revenue: 200 },
      ]);
      expect(body.totalRevenue).toBe(1100);
      expect(body.byDanceStyle).toHaveLength(1);
      expect(body.byDanceStyle[0].revenue).toBe(1100);
    });

    it("?locationId=<id> counts only that location's lessons", async () => {
      const body = await (await call("2026-10", kaohsiungId)).json();

      expect(body.totalRevenue).toBe(600);
      expect(body.byDanceStyle[0].revenue).toBe(600);
      expect(body.byLocation).toEqual([{ location: { id: kaohsiungId, name: "高雄" }, revenue: 600 }]);
    });

    it("?locationId=none counts only lessons without a location", async () => {
      const body = await (await call("2026-10", "none")).json();

      expect(body.totalRevenue).toBe(200);
      expect(body.byLocation).toEqual([{ location: null, revenue: 200 }]);
    });

    it("rejects a malformed locationId", async () => {
      for (const bad of ["abc", "0", "-1", "1.5", "", "99999999999"]) {
        expect((await call("2026-10", bad)).status).toBe(400);
      }
    });

    it("another classroom's location id returns nothing, and its revenue never shows up", async () => {
      const other = await createClassroom({ email: "other@test.local" });
      const otherStyle = await createDanceStyle(other.id, { name: "Salsa" });
      const otherLocation = await createLocation(other.id, { name: "台北" });
      await takenPeriod(
        otherStyle.id,
        "2026-10-05T11:30:00Z",
        { finalPrice: 9000, totalSessions: 1 },
        { locationId: otherLocation.id, inClassroomId: other.id }
      );
      await takenPeriod(
        otherStyle.id,
        "2026-10-05T11:30:00Z",
        { finalPrice: 7000, totalSessions: 1 },
        { inClassroomId: other.id }
      );

      const filtered = await (await call("2026-10", otherLocation.id)).json();
      expect(filtered.totalRevenue).toBe(0);
      expect(filtered.byLocation).toEqual([]);

      const all = await (await call("2026-10")).json();
      expect(all.totalRevenue).toBe(1100);
      expect(all.byLocation.map((l: { location: { name: string } | null }) => l.location?.name ?? null)).toEqual([
        "高雄",
        "台南",
        null,
      ]);

      // 「未指定分部」也只看自己教室的課。
      const none = await (await call("2026-10", "none")).json();
      expect(none.totalRevenue).toBe(200);
    });
  });
});
