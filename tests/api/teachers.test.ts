import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createDanceStyle,
  createLesson,
  createLocation,
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
      [
        "activeLessonCount",
        "archivedAt",
        "color",
        "icon",
        "id",
        "kind",
        "lessonCount",
        "locations",
        "name",
        "note",
        "userId",
      ].sort()
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

  it("POST / PATCH take an emoji icon, a cool colour and the branches", async () => {
    const tainan = await createLocation(classroomId, { name: "台南", sortOrder: 0 });
    const kaohsiung = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });

    let res = await POST(
      jsonRequest("POST", {
        name: "Sean",
        color: "sky",
        icon: "⭐",
        locationIds: [kaohsiung.id, tainan.id],
      }),
      routeParams({})
    );
    const created = await res.json();
    expect(res.status).toBe(200);
    expect(created).toMatchObject({
      color: "sky",
      icon: "⭐",
      locations: [
        { id: tainan.id, name: "台南" },
        { id: kaohsiung.id, name: "高雄" },
      ],
    });
    const id = String(created.id);

    // The list replaces; a null icon goes back to the initial.
    res = await PATCH(
      jsonRequest("PATCH", { icon: null, locationIds: [kaohsiung.id] }),
      routeParams({ id })
    );
    expect(await res.json()).toMatchObject({ icon: null, locations: [{ id: kaohsiung.id }] });

    // Fields left out stay as they are.
    res = await PATCH(jsonRequest("PATCH", { name: "Sean W" }), routeParams({ id }));
    expect(await res.json()).toMatchObject({ name: "Sean W", locations: [{ id: kaohsiung.id }] });
  });

  it("rejects an icon outside the list and another classroom's branch", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const theirs = await createLocation(other.id, { name: "台北" });
    const sean = await createTeacher(classroomId, "Sean");
    const id = String(sean.id);

    expect((await POST(jsonRequest("POST", { name: "Nini", icon: "x" }), routeParams({}))).status).toBe(400);
    const res = await POST(
      jsonRequest("POST", { name: "Nini", locationIds: [theirs.id] }),
      routeParams({})
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("LOCATION_NOT_FOUND");
    expect(
      (await PATCH(jsonRequest("PATCH", { locationIds: [theirs.id] }), routeParams({ id }))).status
    ).toBe(400);
    expect(await prisma.teacher.count()).toBe(1);
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

  it("lists each teacher's in-progress lessons and next period, soonest first", async () => {
    const salsa = await createDanceStyle(classroomId, { name: "Salsa", color: "orange" });
    const tainan = await createLocation(classroomId, { name: "台南" });
    const sean = await createTeacher(classroomId, "Sean");
    const kathy = await createTeacher(classroomId, "Kathy");
    const idle = await createTeacher(classroomId, "Idle");
    await prisma.teacher.update({
      where: { id: kathy.id },
      data: { icon: "🦊", locations: { connect: { id: tainan.id } } },
    });

    const { lesson: bachata } = await createLesson(classroomId, { name: "Bachata 初階" });
    const { lesson: salsaNight } = await createLesson(classroomId, {
      name: "Salsa 練習夜",
      danceStyleId: salsa.id,
    });
    const { lesson: old } = await createLesson(classroomId, { name: "結束的課" });
    await prisma.lesson.update({ where: { id: old.id }, data: { status: "finished" } });
    await teach(bachata.id, sean.id);
    await teach(old.id, sean.id);
    await teach(salsaNight.id, kathy.id);
    await teach(salsaNight.id, sean.id);

    // Past periods and a finished lesson's future period never count as "next".
    await addPeriod(bachata.id, "2026-06-04T12:00:00Z");
    await addPeriod(old.id, "2098-01-01T12:00:00Z", { taken: false });
    await addPeriod(bachata.id, "2099-02-01T12:00:00Z", { taken: false });
    // Under way right now: started half an hour ago, one hour long.
    await addPeriod(salsaNight.id, new Date(Date.now() - 30 * 60 * 1000).toISOString(), {
      taken: false,
    });
    // An in-progress lesson nobody teaches.
    await createLesson(classroomId, { name: "沒老師" });

    const res = await OVERVIEW(getRequest(), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unassignedLessonCount).toBe(1);
    // Sean and Kathy share the period under way (tie → more lessons first); Idle has nothing.
    expect(body.teachers.map((t: { name: string }) => t.name)).toEqual(["Sean", "Kathy", "Idle"]);

    const [seanRow, kathyRow, idleRow] = body.teachers;
    expect(seanRow.lessonCount).toBe(3);
    expect(seanRow.activeLessons.map((l: { name: string }) => l.name)).toEqual([
      "Bachata 初階",
      "Salsa 練習夜",
    ]);
    expect(seanRow.activeLessons[1].danceStyle).toMatchObject({ name: "Salsa", color: "orange" });
    expect(seanRow.nextPeriod).toMatchObject({ lessonName: "Salsa 練習夜", ongoing: true });

    expect(kathyRow).toMatchObject({ icon: "🦊", locations: [{ id: tainan.id, name: "台南" }] });
    expect(kathyRow.nextPeriod).toMatchObject({ lessonId: salsaNight.id, ongoing: true });

    expect(idleRow).toMatchObject({ id: idle.id, activeLessons: [], nextPeriod: null });
    expect(seanRow).not.toHaveProperty("stats");
  });

  it("the next period is a future one when nothing is under way", async () => {
    const sean = await createTeacher(classroomId, "Sean");
    const { lesson } = await createLesson(classroomId, { name: "Bachata 初階" });
    await teach(lesson.id, sean.id);
    await addPeriod(lesson.id, "2099-02-01T12:00:00Z", { taken: false });
    await addPeriod(lesson.id, "2099-01-01T12:00:00Z", { taken: false });

    const body = await (await OVERVIEW(getRequest(), routeParams({}))).json();
    expect(body.teachers[0].nextPeriod).toMatchObject({
      startTime: "2099-01-01T12:00:00.000Z",
      ongoing: false,
    });
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

describe("團隊與老師合併：人員資料連著帳號", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("連著帳號的人員資料不能刪、不能封存（要先移出團隊）", async () => {
    const person = await prisma.teacher.create({ data: { classroomId, name: "丁丁", userId: 1 } });
    const del = await DELETE(jsonRequest("DELETE"), routeParams({ id: String(person.id) }));
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe("PERSON_HAS_ACCOUNT");
    const archive = await PATCH(jsonRequest("PATCH", { archived: true }), routeParams({ id: String(person.id) }));
    expect(archive.status).toBe(409);
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: person.id } })).archivedAt).toBeNull();
  });

  it("老師頁只放會教課的人：純小幫手、不上課的都不在", async () => {
    await prisma.teacher.create({ data: { classroomId, name: "老闆", kind: "NONE" } });
    await prisma.teacher.create({ data: { classroomId, name: "Nora", kind: "ASSISTANT" } });
    await createTeacher(classroomId, "Sean");
    const body = await (await OVERVIEW(getRequest(), routeParams({}))).json();
    expect(body.teachers.map((t: { name: string }) => t.name)).toEqual(["Sean"]);
  });
});
