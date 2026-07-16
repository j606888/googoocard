import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom } from "../factories";

const createTeacher = (classroomId: number, { name }: { name: string }) =>
  prisma.teacher.create({ data: { name, classroomId } });

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET } from "@/app/api/lessons/route";

// Far past / far future so the route's real `new Date()` still classifies them
// deterministically regardless of the machine clock.
const PAST = { start: "2020-01-01T10:00:00Z", end: "2020-01-01T11:00:00Z" };
const FUTURE = { start: "2030-01-01T10:00:00Z", end: "2030-01-01T11:00:00Z" };

async function makeLesson(
  classroomId: number,
  name: string,
  danceType: DanceType,
  periods: { start: string; end: string; taken?: boolean }[] = []
) {
  const lesson = await prisma.lesson.create({
    data: { name, classroomId, danceType, status: "inProgress" },
  });
  for (const p of periods) {
    await prisma.lessonPeriod.create({
      data: {
        lessonId: lesson.id,
        startTime: new Date(p.start),
        endTime: new Date(p.end),
        attendanceTakenAt: p.taken ? new Date(p.end) : null,
      },
    });
  }
  return lesson;
}

function getRequest(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new Request(`http://test.local/api/lessons?${qs}`);
}

describe("GET /api/lessons (list)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("returns summary fields per lesson (no full arrays)", async () => {
    const teacher = await createTeacher(classroomId, { name: "Alice" });
    const lesson = await makeLesson(classroomId, "Bachata Lv1", DanceType.BACHATA, [
      { ...PAST, taken: true },
      FUTURE,
    ]);
    await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: teacher.id } });

    const res = await GET(getRequest({ tab: "inProgress", sort: "name" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lessons).toHaveLength(1);
    const l = body.lessons[0];
    expect(l).toMatchObject({
      id: lesson.id,
      name: "Bachata Lv1",
      danceType: "BACHATA",
      studentCount: 0,
      totalPeriods: 2,
      attendedCount: 1,
      teachers: [{ id: teacher.id, name: "Alice" }],
    });
    // Next = future session; not due (only past one is checked).
    expect(l.nextSessionDate).not.toBeNull();
    expect(l.dueForAttendanceCount).toBe(0);
    // No heavy relations leaked.
    expect(l).not.toHaveProperty("periods");
    expect(l).not.toHaveProperty("students");
  });

  it("flags due-for-attendance when a past period is unchecked", async () => {
    await makeLesson(classroomId, "Overdue", DanceType.BACHATA, [PAST]);

    const res = await GET(getRequest({ tab: "inProgress", sort: "name" }));
    const body = await res.json();
    const l = body.lessons[0];
    expect(l.dueForAttendanceCount).toBe(1);
    expect(l.dueForAttendancePeriodId).not.toBeNull();
  });

  it("filters by search on lesson name and teacher name", async () => {
    const teacher = await createTeacher(classroomId, { name: "Bob" });
    const salsa = await makeLesson(classroomId, "Salsa Party", DanceType.SALSA);
    await prisma.lessonTeacher.create({ data: { lessonId: salsa.id, teacherId: teacher.id } });
    await makeLesson(classroomId, "Bachata Basics", DanceType.BACHATA);

    const byName = await (await GET(getRequest({ tab: "inProgress", sort: "name", search: "Bachata" }))).json();
    expect(byName.lessons.map((l: { name: string }) => l.name)).toEqual(["Bachata Basics"]);

    const byTeacher = await (await GET(getRequest({ tab: "inProgress", sort: "name", search: "bob" }))).json();
    expect(byTeacher.lessons.map((l: { name: string }) => l.name)).toEqual(["Salsa Party"]);
  });

  it("filters by danceType and reflects it in tabsCount", async () => {
    await makeLesson(classroomId, "Bachata A", DanceType.BACHATA);
    await makeLesson(classroomId, "Salsa B", DanceType.SALSA);

    const res = await GET(getRequest({ tab: "inProgress", sort: "name", danceType: "SALSA" }));
    const body = await res.json();
    expect(body.lessons.map((l: { name: string }) => l.name)).toEqual(["Salsa B"]);
    expect(body.tabsCount.inProgress).toBe(1);
  });

  it("availableDanceTypes lists only dance types with lessons, unaffected by filters", async () => {
    await makeLesson(classroomId, "Bachata A", DanceType.BACHATA);
    await makeLesson(classroomId, "Salsa B", DanceType.SALSA);

    // Even while filtering to SALSA, the available set stays classroom-wide.
    const res = await GET(getRequest({ tab: "inProgress", sort: "name", danceType: "SALSA" }));
    const body = await res.json();
    expect([...body.availableDanceTypes].sort()).toEqual(["BACHATA", "SALSA"]);
    expect(body.availableDanceTypes).not.toContain("ZOUK");
  });

  it("paginates only when page is provided", async () => {
    for (let i = 0; i < 25; i++) {
      await makeLesson(classroomId, `L${String(i).padStart(2, "0")}`, DanceType.BACHATA);
    }

    // No page param -> all 25, no next page.
    const all = await (await GET(getRequest({ tab: "inProgress", sort: "name" }))).json();
    expect(all.lessons).toHaveLength(25);
    expect(all.hasNextPage).toBe(false);

    // page=1 -> first 20, hasNextPage true.
    const p1 = await (await GET(getRequest({ tab: "inProgress", sort: "name", page: "1" }))).json();
    expect(p1.lessons).toHaveLength(20);
    expect(p1.hasNextPage).toBe(true);

    // page=2 -> cumulative 25 (load-more semantics), no next page.
    const p2 = await (await GET(getRequest({ tab: "inProgress", sort: "name", page: "2" }))).json();
    expect(p2.lessons).toHaveLength(25);
    expect(p2.hasNextPage).toBe(false);
  });

  it("sorts by next session ascending, sessionless lessons last", async () => {
    await makeLesson(classroomId, "Later", DanceType.BACHATA, [
      { start: "2031-01-01T10:00:00Z", end: "2031-01-01T11:00:00Z" },
    ]);
    await makeLesson(classroomId, "Sooner", DanceType.BACHATA, [FUTURE]);
    await makeLesson(classroomId, "NoUpcoming", DanceType.BACHATA, [PAST]);

    const res = await GET(getRequest({ tab: "inProgress", sort: "nextSession" }));
    const body = await res.json();
    expect(body.lessons.map((l: { name: string }) => l.name)).toEqual([
      "Sooner",
      "Later",
      "NoUpcoming",
    ]);
  });
});
