import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createDanceStyle,
  createLesson,
  createStudent,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as LIST, POST } from "@/app/api/teachers/route";
import { GET as DETAIL, PATCH, DELETE } from "@/app/api/teachers/[id]/route";
import { GET as OVERVIEW } from "@/app/api/teachers/overview/route";
import { POST as CREATE_LESSON } from "@/app/api/lessons/route";
import { PUT as UPDATE_LESSON } from "@/app/api/lessons/[id]/route";

function getRequest(query = "") {
  return new Request(`http://test.local/api${query}`);
}

async function createTeacher(classroomId: number, name: string, data: { color?: string } = {}) {
  return prisma.teacher.create({ data: { classroomId, name, ...data } });
}

async function teach(lessonId: number, teacherId: number) {
  await prisma.lessonTeacher.create({ data: { lessonId, teacherId } });
}

/** A one-hour period; `studentIds` get attendance records. */
async function addPeriod(
  lessonId: number,
  start: string,
  { taken = true, studentIds = [] as number[] } = {}
) {
  const startTime = new Date(start);
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? startTime : null,
    },
  });
  for (const studentId of studentIds) {
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId } });
  }
  return period;
}

describe("/api/teachers", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("GET lists this classroom's teachers, whitelisted, with lesson counts", async () => {
    const sean = await createTeacher(classroomId, "Sean");
    await createTeacher(classroomId, "Kathy");
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    await createTeacher(other.id, "Stranger");

    const { lesson: active } = await createLesson(classroomId);
    const { lesson: done } = await createLesson(classroomId, { name: "Old" });
    await prisma.lesson.update({ where: { id: done.id }, data: { status: "finished" } });
    await teach(active.id, sean.id);
    await teach(done.id, sean.id);

    const res = await LIST(jsonRequest("GET"), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((t: { name: string }) => t.name)).toEqual(["Sean", "Kathy"]);
    expect(Object.keys(body[0]).sort()).toEqual(
      ["activeLessonCount", "archivedAt", "color", "id", "isAssistant", "lessonCount", "name", "note", "userId"].sort()
    );
    expect(body[0]).toMatchObject({ lessonCount: 2, activeLessonCount: 1 });
    expect(body[1]).toMatchObject({ lessonCount: 0, activeLessonCount: 0 });
  });

  it("POST trims, and picks the first colour no active teacher uses", async () => {
    await createTeacher(classroomId, "Sean", { color: "blue" });
    const archived = await createTeacher(classroomId, "Gone", { color: "orange" });
    await prisma.teacher.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });

    const res = await POST(jsonRequest("POST", { name: "  Nini  ", note: "  " }), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    // orange is free again: its teacher is archived.
    expect(body).toMatchObject({ name: "Nini", color: "orange", note: null, archivedAt: null });
    const row = await prisma.teacher.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.classroomId).toBe(classroomId);
  });

  it("POST rejects a blank name and an unknown colour", async () => {
    for (const body of [{ name: "  " }, { name: "Nini", color: "chartreuse" }]) {
      const res = await POST(jsonRequest("POST", body), routeParams({}));
      expect(res.status).toBe(400);
    }
    expect(await prisma.teacher.count()).toBe(0);
  });

  it("PATCH renames, recolours, sets and clears the note, archives and restores", async () => {
    const sean = await createTeacher(classroomId, "Sean");
    const id = String(sean.id);

    let res = await PATCH(
      jsonRequest("PATCH", { name: "Sean W", color: "teal", note: "週二、四可排課" }),
      routeParams({ id })
    );
    expect(await res.json()).toMatchObject({ name: "Sean W", color: "teal", note: "週二、四可排課" });

    res = await PATCH(jsonRequest("PATCH", { note: "", archived: true }), routeParams({ id }));
    const archived = await res.json();
    expect(archived.note).toBeNull();
    expect(archived.archivedAt).not.toBeNull();

    res = await PATCH(jsonRequest("PATCH", { archived: false }), routeParams({ id }));
    expect((await res.json()).archivedAt).toBeNull();
  });

  it("PATCH / DELETE / GET on another classroom's teacher → 404", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const stranger = await createTeacher(other.id, "Stranger");
    const id = String(stranger.id);

    expect((await PATCH(jsonRequest("PATCH", { name: "Mine" }), routeParams({ id }))).status).toBe(404);
    expect((await DELETE(jsonRequest("DELETE"), routeParams({ id }))).status).toBe(404);
    expect((await DETAIL(getRequest(), routeParams({ id }))).status).toBe(404);
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: stranger.id } })).name).toBe(
      "Stranger"
    );
  });

  it("DELETE only removes a teacher who never had a lesson", async () => {
    const sean = await createTeacher(classroomId, "Sean");
    const typo = await createTeacher(classroomId, "Saen");
    const { lesson } = await createLesson(classroomId);
    await teach(lesson.id, sean.id);

    const blocked = await DELETE(jsonRequest("DELETE"), routeParams({ id: String(sean.id) }));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("TEACHER_HAS_LESSONS");

    const ok = await DELETE(jsonRequest("DELETE"), routeParams({ id: String(typo.id) }));
    expect(ok.status).toBe(200);
    expect(await prisma.teacher.count()).toBe(1);
  });
});

describe("GET /api/teachers/overview", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("counts the month's taught periods per teacher and sorts by them", async () => {
    const salsa = await createDanceStyle(classroomId, { name: "Salsa", color: "orange" });
    const sean = await createTeacher(classroomId, "Sean");
    const kathy = await createTeacher(classroomId, "Kathy");
    const [a, b] = [await createStudent(classroomId, { name: "A" }), await createStudent(classroomId, { name: "B" })];

    const { lesson: bachata } = await createLesson(classroomId, { name: "Bachata 初階" });
    const { lesson: salsaNight } = await createLesson(classroomId, {
      name: "Salsa 練習夜",
      danceStyleId: salsa.id,
    });
    await teach(bachata.id, sean.id);
    await teach(salsaNight.id, kathy.id);
    await teach(salsaNight.id, sean.id);

    // June 2026 (Taipei).
    await addPeriod(bachata.id, "2026-06-04T12:00:00Z", { studentIds: [a.id, b.id] });
    await addPeriod(bachata.id, "2026-06-11T12:00:00Z", { taken: false, studentIds: [a.id] });
    await addPeriod(salsaNight.id, "2026-06-09T12:00:00Z", { studentIds: [a.id] });
    // May: trend only.
    await addPeriod(bachata.id, "2026-05-28T12:00:00Z", { studentIds: [b.id] });
    // Next period, far in the future.
    await addPeriod(salsaNight.id, "2099-01-01T12:00:00Z", { taken: false });
    // An in-progress lesson nobody teaches.
    await createLesson(classroomId, { name: "沒老師" });

    const res = await OVERVIEW(getRequest("?month=2026-06"), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.month).toBe("2026-06");
    expect(body.months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(body.unassignedLessonCount).toBe(1);
    // The co-taught Salsa period counts once classroom-wide.
    expect(body.totals).toMatchObject({ sessions: 2, attendance: 3, pendingCount: 1 });
    expect(body.teachers.map((t: { name: string }) => t.name)).toEqual(["Sean", "Kathy"]);

    const [seanRow, kathyRow] = body.teachers;
    expect(seanRow.stats).toEqual({
      sessions: 2,
      pendingCount: 1,
      attendance: 3,
      uniqueStudents: 2,
      avgAttendance: 1.5,
    });
    expect(seanRow.trend).toEqual([0, 0, 0, 0, 1, 2]);
    expect(seanRow.danceStyles.map((s: { name: string }) => s.name).sort()).toEqual(
      ["Bachata", "Salsa"].sort()
    );
    expect(seanRow).toMatchObject({ lessonCount: 2, activeLessonCount: 2 });
    expect(seanRow.nextPeriod).toMatchObject({ lessonName: "Salsa 練習夜" });

    expect(kathyRow.stats).toMatchObject({ sessions: 1, attendance: 1, pendingCount: 0 });
    expect(kathyRow.danceStyles.map((s: { name: string }) => s.name)).toEqual(["Salsa"]);
  });

  it("rejects a malformed month", async () => {
    const res = await OVERVIEW(getRequest("?month=2026-13"), routeParams({}));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/teachers/[id]", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("returns the month's periods, numbers, lessons and regulars", async () => {
    const sean = await createTeacher(classroomId, "Sean");
    const a = await createStudent(classroomId, { name: "A" });
    const b = await createStudent(classroomId, { name: "B" });
    const { lesson } = await createLesson(classroomId, { name: "Bachata 初階" });
    await teach(lesson.id, sean.id);
    // Someone else's lesson in the same month doesn't count.
    const { lesson: notMine } = await createLesson(classroomId, { name: "別人的課" });
    await addPeriod(notMine.id, "2026-06-05T12:00:00Z", { studentIds: [a.id] });

    await addPeriod(lesson.id, "2026-05-28T12:00:00Z", { studentIds: [a.id] });
    await addPeriod(lesson.id, "2026-06-04T12:00:00Z", { studentIds: [a.id, b.id] });
    await addPeriod(lesson.id, "2026-06-11T12:00:00Z", { taken: false });

    const res = await DETAIL(getRequest("?month=2026-06"), routeParams({ id: String(sean.id) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.teacher).toMatchObject({ id: sean.id, name: "Sean" });
    expect(body.stats).toEqual({
      sessions: 1,
      pendingCount: 1,
      attendance: 2,
      uniqueStudents: 2,
      avgAttendance: 2,
    });
    expect(body.previousMonthAttendance).toBe(1);
    expect(body.periods.map((p: { state: string }) => p.state)).toEqual(["done", "pending"]);
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0]).toMatchObject({
      name: "Bachata 初階",
      totalPeriods: 3,
      taughtCount: 2,
      avgAttendance: 1.5,
    });
    expect(new Date(body.firstTaughtAt).toISOString()).toBe("2026-05-28T12:00:00.000Z");
    expect(body.regulars.map((r: { name: string; count: number }) => [r.name, r.count])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
    expect(Object.keys(body.regulars[0]).sort()).toEqual(["avatarUrl", "count", "id", "name"]);
  });
});

describe("課程的 teacherIds 要是本教室的老師", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("POST / PUT with another classroom's teacher → 400 TEACHER_NOT_FOUND", async () => {
    const style = await createDanceStyle(classroomId, { name: "Bachata" });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const stranger = await createTeacher(other.id, "Stranger");
    const mine = await createTeacher(classroomId, "Sean");

    const draft = (teacherIds: number[]) => ({
      lessonName: "L",
      teacherIds,
      cardIds: [],
      danceStyleId: style.id,
      periods: [{ startTime: "2026-06-01T10:00:00Z", endTime: "2026-06-01T11:00:00Z" }],
    });

    const created = await CREATE_LESSON(jsonRequest("POST", draft([stranger.id])));
    expect(created.status).toBe(400);
    expect((await created.json()).error).toBe("TEACHER_NOT_FOUND");
    expect(await prisma.lesson.count()).toBe(0);

    const { lesson } = await createLesson(classroomId, { danceStyleId: style.id });
    const updated = await UPDATE_LESSON(
      jsonRequest("PUT", draft([mine.id, stranger.id])),
      routeParams({ id: String(lesson.id) })
    );
    expect(updated.status).toBe(400);
    expect(await prisma.lessonTeacher.count()).toBe(0);

    const ok = await UPDATE_LESSON(
      jsonRequest("PUT", draft([mine.id])),
      routeParams({ id: String(lesson.id) })
    );
    expect(ok.status).toBe(200);
  });
});
