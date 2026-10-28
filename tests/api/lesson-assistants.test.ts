import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLocation,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, PUT } from "@/app/api/lessons/[id]/periods/[periodId]/assistants/route";
import { POST as CREATE_TEACHER } from "@/app/api/teachers/route";
import { PATCH as UPDATE_TEACHER, DELETE as DELETE_TEACHER } from "@/app/api/teachers/[id]/route";

const params = (lessonId: number, periodId: number) =>
  routeParams({ id: String(lessonId), periodId: String(periodId) });
const get = (lessonId: number, periodId: number) =>
  GET(new Request("http://test.local/api"), params(lessonId, periodId));
const put = (lessonId: number, periodId: number, teacherIds: number[]) =>
  PUT(jsonRequest("PUT", { teacherIds }), params(lessonId, periodId));

const teacher = (classroomId: number, name: string, data: { archivedAt?: Date; isAssistant?: boolean } = {}) =>
  prisma.teacher.create({ data: { classroomId, name, ...data } });

/** 10/25（日）台北時間 hh:00 那一堂。 */
const period = (lessonId: number, hour: number, day = 25) =>
  prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime: new Date(`2026-10-${day}T${String(hour - 8).padStart(2, "0")}:00:00Z`),
      endTime: new Date(`2026-10-${day}T${String(hour - 7).padStart(2, "0")}:00:00Z`),
    },
  });

describe("/api/lessons/[id]/periods/[periodId]/assistants", () => {
  let classroomId: number;
  let lessonId: number;
  let periodId: number;
  let sean: { id: number };
  let akai: { id: number };
  let nini: { id: number };

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    sean = await teacher(classroomId, "Sean");
    akai = await teacher(classroomId, "阿凱", { isAssistant: true });
    nini = await teacher(classroomId, "Nini");
    const { lesson } = await createLesson(classroomId, { name: "Body movement" });
    lessonId = lesson.id;
    await prisma.lessonTeacher.create({ data: { lessonId, teacherId: sean.id } });
    periodId = (await period(lessonId, 14)).id;
  });

  it("沒記過也沒得帶：空的、不是建議", async () => {
    const res = await get(lessonId, periodId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ assistants: [], suggested: false });
  });

  it("整組覆寫：加、換、清空", async () => {
    let res = await put(lessonId, periodId, [akai.id]);
    expect(res.status).toBe(200);
    expect((await res.json()).assistants.map((t: { name: string }) => t.name)).toEqual(["阿凱"]);

    res = await put(lessonId, periodId, [nini.id, akai.id, nini.id]);
    expect((await res.json()).assistants.map((t: { name: string }) => t.name)).toEqual(["阿凱", "Nini"]);

    res = await put(lessonId, periodId, [nini.id]);
    expect((await res.json()).assistants.map((t: { name: string }) => t.name)).toEqual(["Nini"]);

    await put(lessonId, periodId, []);
    expect(await prisma.lessonPeriodAssistant.count()).toBe(0);
  });

  describe("帶入同一天上一堂的助教", () => {
    let laterLessonId: number;
    let laterPeriodId: number;

    beforeEach(async () => {
      await put(lessonId, periodId, [akai.id]);
      const { lesson } = await createLesson(classroomId, { name: "Bachata lv2" });
      laterLessonId = lesson.id;
      laterPeriodId = (await period(laterLessonId, 15)).id;
    });

    it("同一天、同一分部、比較早的那堂有記 → 建議", async () => {
      const body = await (await get(laterLessonId, laterPeriodId)).json();
      expect(body.suggested).toBe(true);
      expect(body.assistants.map((t: { name: string }) => t.name)).toEqual(["阿凱"]);
      // 只是建議，還沒存
      expect(await prisma.lessonPeriodAssistant.count({ where: { lessonPeriodId: laterPeriodId } })).toBe(0);
    });

    it("比這堂晚的、別天的、別的分部的都不帶", async () => {
      const earlier = await period(laterLessonId, 10);
      expect((await (await get(laterLessonId, earlier.id)).json()).suggested).toBe(false);

      const nextDay = await period(laterLessonId, 15, 26);
      expect((await (await get(laterLessonId, nextDay.id)).json()).suggested).toBe(false);

      const tainan = await createLocation(classroomId, { name: "台南" });
      await prisma.lesson.update({ where: { id: laterLessonId }, data: { locationId: tainan.id } });
      expect((await (await get(laterLessonId, laterPeriodId)).json()).suggested).toBe(false);
    });

    it("已經點過名、這堂自己有記、或那位是這堂的老師 → 不帶", async () => {
      await prisma.lessonPeriod.update({ where: { id: laterPeriodId }, data: { attendanceTakenAt: new Date() } });
      expect((await (await get(laterLessonId, laterPeriodId)).json()).suggested).toBe(false);

      await prisma.lessonPeriod.update({ where: { id: laterPeriodId }, data: { attendanceTakenAt: null } });
      await prisma.lessonTeacher.create({ data: { lessonId: laterLessonId, teacherId: akai.id } });
      expect(await (await get(laterLessonId, laterPeriodId)).json()).toEqual({ assistants: [], suggested: false });
    });

    it("封存的老師不帶", async () => {
      await prisma.teacher.update({ where: { id: akai.id }, data: { archivedAt: new Date() } });
      expect((await (await get(laterLessonId, laterPeriodId)).json()).suggested).toBe(false);
    });
  });

  it("擋：這堂的老師、別間教室的老師、新加封存的老師", async () => {
    let res = await put(lessonId, periodId, [sean.id]);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ASSISTANT_IS_TEACHER");

    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const outsider = await teacher(other.id, "外人");
    res = await put(lessonId, periodId, [outsider.id]);
    expect(res.status).toBe(400);

    const gone = await teacher(classroomId, "離職", { archivedAt: new Date() });
    res = await put(lessonId, periodId, [gone.id]);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TEACHER_ARCHIVED");

    // 已經掛著的封存老師可以留著
    await prisma.lessonPeriodAssistant.create({ data: { lessonPeriodId: periodId, teacherId: gone.id } });
    res = await put(lessonId, periodId, [gone.id, akai.id]);
    expect(res.status).toBe(200);
  });

  it("別間教室的課回 404", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const { lesson } = await createLesson(other.id);
    const otherPeriod = await period(lesson.id, 14);
    expect((await get(lesson.id, otherPeriod.id)).status).toBe(404);
    expect((await put(lesson.id, otherPeriod.id, [])).status).toBe(404);
    // 期數不屬於這堂課也是 404
    expect((await get(lessonId, otherPeriod.id)).status).toBe(404);
  });

  it("當過助教的老師不能刪，只能封存", async () => {
    await put(lessonId, periodId, [akai.id]);
    const res = await DELETE_TEACHER(new Request("http://test.local/api"), routeParams({ id: String(akai.id) }));
    expect(res.status).toBe(409);
  });

  it("老師資料可以標成只當助教", async () => {
    let res = await CREATE_TEACHER(jsonRequest("POST", { name: "小幫手", isAssistant: true }), routeParams({}));
    const created = await res.json();
    expect(created.isAssistant).toBe(true);

    res = await UPDATE_TEACHER(jsonRequest("PATCH", { isAssistant: false }), routeParams({ id: String(created.id) }));
    expect((await res.json()).isAssistant).toBe(false);
  });
});
