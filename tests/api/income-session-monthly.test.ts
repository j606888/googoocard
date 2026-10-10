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
  { taken = true }: { taken?: boolean } = {}
) {
  const { lesson } = await createLesson(classroomId, { danceStyleId });
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId: lesson.id,
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? new Date(startTime) : null,
    },
  });
  const student = await createStudent(classroomId, { name: `S${period.id}` });
  let studentCardId: number | null = null;
  if (card) {
    const c = await createCard(classroomId);
    studentCardId = (await createStudentCard(student.id, c.id, card)).id;
  }
  await prisma.attendanceRecord.create({
    data: { lessonPeriodId: period.id, studentId: student.id, studentCardId },
  });
}

function call(month: string) {
  return GET(new Request(`http://test.local/api/income/session-monthly/${month}`), routeParams({ month }));
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
});
