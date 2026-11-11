import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLocation,
  createMember,
  defaultDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0, role: "owner" }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as LIST_LESSONS, POST as CREATE_LESSON } from "@/app/api/lessons/route";
import { GET as LESSON_DETAIL, PUT as UPDATE_LESSON, DELETE as DELETE_LESSON } from "@/app/api/lessons/[id]/route";
import { GET as OVERVIEW } from "@/app/api/teachers/overview/route";
import { GET as TEACHER_DETAIL, DELETE as DELETE_TEACHER } from "@/app/api/teachers/[id]/route";
import { PATCH as UPDATE_MEMBER } from "@/app/api/memberships/[id]/route";
import { GET as MY_LESSONS } from "@/app/api/me/lessons/route";
import { getLessonAgenda } from "@/service/lessonAgenda";

const NOW = new Date("2026-10-29T07:20:00Z");

const getRequest = (query = "") => new Request(`http://test.local/api${query}`);
const teacher = (classroomId: number, name: string, kind: "TEACHER" | "ASSISTANT" | "BOTH" = "TEACHER") =>
  prisma.teacher.create({ data: { classroomId, name, kind } });
const assistantIdsOf = async (lessonId: number) =>
  (await prisma.lessonAssistant.findMany({ where: { lessonId }, orderBy: { teacherId: "asc" } })).map(
    (row) => row.teacherId
  );

async function addPeriod(lessonId: number, start: string, taken = false) {
  const startTime = new Date(start);
  return prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? startTime : null,
    },
  });
}

describe("課程小幫手", () => {
  let classroomId: number;
  let danceStyleId: number;
  let sean: { id: number };
  let ding: { id: number };
  let amy: { id: number };

  const draft = (extra: Record<string, unknown> = {}) => ({
    lessonName: "Bachata 初階",
    teacherIds: [sean.id],
    cardIds: [],
    danceStyleId,
    periods: [{ startTime: "2026-11-01T10:00:00Z", endTime: "2026-11-01T11:00:00Z" }],
    ...extra,
  });
  const put = (lessonId: number, extra: Record<string, unknown> = {}) =>
    UPDATE_LESSON(jsonRequest("PUT", draft(extra)), routeParams({ id: String(lessonId) }));

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
    auth.role = "owner";
    danceStyleId = (await defaultDanceStyle(classroomId)).id;
    sean = await teacher(classroomId, "Sean");
    ding = await teacher(classroomId, "丁丁", "ASSISTANT");
    // （本機測試 DB 的 TeacherKind enum 被 finance 分支的 migration 改過、沒有 BOTH，所以這裡不用它。）
    amy = await teacher(classroomId, "Amy", "ASSISTANT");
  });

  describe("POST / PUT /api/lessons 的 assistantIds", () => {
    it("建立時帶小幫手；清單與詳情都回 assistants（跟 teachers 同形狀）", async () => {
      const res = await CREATE_LESSON(jsonRequest("POST", draft({ assistantIds: [ding.id, amy.id] })));
      expect(res.status).toBe(200);
      const lesson = await prisma.lesson.findFirstOrThrow();
      expect(await assistantIdsOf(lesson.id)).toEqual([ding.id, amy.id]);

      const list = await (await LIST_LESSONS(getRequest("/lessons?tab=inProgress"))).json();
      expect(list.lessons[0].teachers).toEqual([{ id: sean.id, name: "Sean", color: "blue" }]);
      expect(list.lessons[0].assistants).toEqual([
        { id: ding.id, name: "丁丁", color: "blue" },
        { id: amy.id, name: "Amy", color: "blue" },
      ]);

      const detail = await (
        await LESSON_DETAIL(getRequest(), routeParams({ id: String(lesson.id) }))
      ).json();
      expect(detail.assistants.map((a: { id: number }) => a.id)).toEqual([ding.id, amy.id]);
      expect(detail.teachers.map((t: { id: number }) => t.id)).toEqual([sean.id]);
    });

    it("沒帶 assistantIds → 沒有小幫手，assistants 是空陣列", async () => {
      expect((await CREATE_LESSON(jsonRequest("POST", draft()))).status).toBe(200);
      const list = await (await LIST_LESSONS(getRequest("/lessons?tab=inProgress"))).json();
      expect(list.lessons[0].assistants).toEqual([]);
    });

    it("別間教室的老師當小幫手 → 400 ASSISTANT_NOT_FOUND，什麼都沒建", async () => {
      const other = await createClassroom({ name: "Other", email: "other@test.local" });
      const foreign = await teacher(other.id, "外人");

      const res = await CREATE_LESSON(jsonRequest("POST", draft({ assistantIds: [foreign.id] })));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("ASSISTANT_NOT_FOUND");
      expect(await prisma.lesson.count()).toBe(0);

      const { lesson } = await createLesson(classroomId);
      const updated = await put(lesson.id, { assistantIds: [ding.id, foreign.id] });
      expect(updated.status).toBe(400);
      expect((await updated.json()).error).toBe("ASSISTANT_NOT_FOUND");
      expect(await assistantIdsOf(lesson.id)).toEqual([]);
    });

    it("同一個人又是老師又是小幫手 → 400 ASSISTANT_IS_TEACHER", async () => {
      const res = await CREATE_LESSON(jsonRequest("POST", draft({ assistantIds: [sean.id] })));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("ASSISTANT_IS_TEACHER");
      expect(await prisma.lesson.count()).toBe(0);

      const { lesson } = await createLesson(classroomId);
      const updated = await put(lesson.id, { teacherIds: [sean.id, amy.id], assistantIds: [amy.id] });
      expect(updated.status).toBe(400);
      expect((await updated.json()).error).toBe("ASSISTANT_IS_TEACHER");
    });

    it("不是陣列或不是整數 → 400", async () => {
      expect((await CREATE_LESSON(jsonRequest("POST", draft({ assistantIds: "1" })))).status).toBe(400);
      expect((await CREATE_LESSON(jsonRequest("POST", draft({ assistantIds: [1.5] })))).status).toBe(400);
    });

    it("PUT 整份取代；沒帶 = 不動，但剛變成老師的人會從小幫手拿掉", async () => {
      const { lesson } = await createLesson(classroomId);
      expect((await put(lesson.id, { assistantIds: [ding.id, amy.id] })).status).toBe(200);
      expect(await assistantIdsOf(lesson.id)).toEqual([ding.id, amy.id]);

      expect((await put(lesson.id, { assistantIds: [amy.id] })).status).toBe(200);
      expect(await assistantIdsOf(lesson.id)).toEqual([amy.id]);

      // 舊的 client 不送 assistantIds：小幫手留著。
      expect((await put(lesson.id)).status).toBe(200);
      expect(await assistantIdsOf(lesson.id)).toEqual([amy.id]);

      // …但把 Amy 改成老師時，她不再是小幫手。
      expect((await put(lesson.id, { teacherIds: [sean.id, amy.id] })).status).toBe(200);
      expect(await assistantIdsOf(lesson.id)).toEqual([]);

      expect((await put(lesson.id, { assistantIds: [ding.id] })).status).toBe(200);
      expect((await put(lesson.id, { assistantIds: [] })).status).toBe(200);
      expect(await assistantIdsOf(lesson.id)).toEqual([]);
    });

    it("刪除有小幫手的課不會卡在外鍵", async () => {
      const { lesson } = await createLesson(classroomId);
      await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: ding.id } });
      const res = await DELETE_LESSON(jsonRequest("DELETE"), routeParams({ id: String(lesson.id) }));
      expect(res.status).toBe(200);
      expect(await prisma.lesson.count()).toBe(0);
    });
  });

  describe("getLessonAgenda", () => {
    it("每堂課帶 assistants 與 location；往後只帶 7 天內開始的時段，而且不再只取 10 堂", async () => {
      const tainan = await createLocation(classroomId, { name: "台南" });
      const { lesson } = await createLesson(classroomId, { name: "Bachata", locationId: tainan.id });
      await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: sean.id } });
      await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: ding.id } });
      const { lesson: noPlace } = await createLesson(classroomId, { name: "沒分部" });

      // 7 天內 12 堂（超過舊的 take: 10），加上剛好第 7 天與超過 7 天的各一堂。
      const within: number[] = [];
      for (let i = 1; i <= 12; i++) {
        const start = new Date(NOW.getTime() + i * 10 * 60 * 60 * 1000); // 每 10 小時一堂，最遠 5 天
        within.push((await addPeriod(lesson.id, start.toISOString())).id);
      }
      const edge = await addPeriod(noPlace.id, new Date(NOW.getTime() + 7 * 86400000).toISOString());
      const beyond = await addPeriod(noPlace.id, new Date(NOW.getTime() + 7 * 86400000 + 60000).toISOString());
      // 已開始還沒點名的照舊（不受 7 天限制）。
      const overdue = await addPeriod(lesson.id, "2026-09-01T07:00:00Z");

      const result = await getLessonAgenda(classroomId, NOW);
      const ids = result.periods.map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining([...within, edge.id, overdue.id]));
      expect(ids).not.toContain(beyond.id);
      expect(result.myTeacherId).toBeNull();

      const mine = result.periods.find((p) => p.id === within[0])!;
      expect(mine.lesson.location).toEqual({ id: tainan.id, name: "台南" });
      expect(mine.lesson.teachers).toEqual([{ id: sean.id, name: "Sean", color: "blue" }]);
      expect(mine.lesson.assistants).toEqual([{ id: ding.id, name: "丁丁", color: "blue" }]);
      const bare = result.periods.find((p) => p.id === edge.id)!;
      expect(bare.lesson.location).toBeNull();
      expect(bare.lesson.assistants).toEqual([]);
    });

    it("我當小幫手的課也算「我的課」：超過 7 天的下一堂照樣帶回來", async () => {
      const helper = await createMember(classroomId, { email: "ding@test.local", name: "丁丁" });
      await prisma.teacher.update({ where: { id: ding.id }, data: { userId: helper.id } });
      const { lesson } = await createLesson(classroomId, { name: "我協助的課" });
      await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: sean.id } });
      await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: ding.id } });
      const far = await addPeriod(lesson.id, "2026-11-20T07:00:00Z");

      const result = await getLessonAgenda(classroomId, NOW, helper.id);
      expect(result.myTeacherId).toBe(ding.id);
      expect(result.periods.map((p) => p.id)).toContain(far.id);
      // 沒連老師資料的人看不到這一堂（在 7 天之外）。
      expect((await getLessonAgenda(classroomId, NOW)).periods).toEqual([]);
    });
  });

  describe("小幫手成員連老師資料", () => {
    it("PATCH /api/memberships/[id]：小幫手可以連人員資料；/api/me/lessons 帶出協助的課", async () => {
      const helper = await createMember(classroomId, { email: "ding@test.local", name: "丁丁" });
      const membership = await prisma.membership.findFirstOrThrow({
        where: { userId: helper.id, classroomId },
      });
      const patch = (body: unknown) =>
        UPDATE_MEMBER(jsonRequest("PATCH", body), routeParams({ id: String(membership.id) }));

      expect((await patch({ teacherId: ding.id })).status).toBe(200);
      expect((await prisma.teacher.findUniqueOrThrow({ where: { id: ding.id } })).userId).toBe(helper.id);
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } })).role).toBe(
        "assistant"
      );

      const { lesson } = await createLesson(classroomId, { name: "我協助的課" });
      await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: ding.id } });
      await addPeriod(lesson.id, new Date(Date.now() + 60 * 60 * 1000).toISOString());
      auth.userId = helper.id;
      auth.role = "assistant";
      const mine = await (await MY_LESSONS(jsonRequest("GET"), routeParams({}))).json();
      expect(mine.teacher).toMatchObject({ id: ding.id });
      expect(mine.periods.map((p: { lesson: { id: number } }) => p.lesson.id)).toEqual([lesson.id]);
      expect(mine.periods[0].lesson.assistants).toEqual([{ id: ding.id, name: "丁丁", color: "blue" }]);
    });
  });

  describe("老師頁的「協助」", () => {
    it("協助的課另外列、不算教課，也不進統計；有協助過課的老師不能刪", async () => {
      const { lesson: taught } = await createLesson(classroomId, { name: "Amy 教的" });
      const { lesson: assisted } = await createLesson(classroomId, { name: "Amy 協助的" });
      const { lesson: done } = await createLesson(classroomId, { name: "結束的協助" });
      await prisma.lesson.update({ where: { id: done.id }, data: { status: "finished" } });
      await prisma.lessonTeacher.create({ data: { lessonId: taught.id, teacherId: amy.id } });
      await prisma.lessonTeacher.create({ data: { lessonId: assisted.id, teacherId: sean.id } });
      await prisma.lessonAssistant.createMany({
        data: [
          { lessonId: assisted.id, teacherId: amy.id },
          { lessonId: done.id, teacherId: amy.id },
          { lessonId: assisted.id, teacherId: ding.id },
        ],
      });
      // 協助的課這個月點過一堂名——不能算進 Amy 的已上堂數。
      await addPeriod(assisted.id, "2026-10-05T12:00:00Z", true);
      await addPeriod(assisted.id, "2099-01-01T12:00:00Z");

      const overview = await (await OVERVIEW(getRequest(), routeParams({}))).json();
      const amyRow = overview.teachers.find((t: { id: number }) => t.id === amy.id);
      expect(amyRow.activeLessons.map((l: { name: string }) => l.name)).toEqual(["Amy 教的"]);
      expect(amyRow.assistedLessons.map((l: { name: string }) => l.name)).toEqual(["Amy 協助的"]);
      expect(amyRow.lessonCount).toBe(1);
      expect(amyRow.nextPeriod).toBeNull();
      const dingRow = overview.teachers.find((t: { id: number }) => t.id === ding.id);
      expect(dingRow).toMatchObject({ activeLessons: [], lessonCount: 0, nextPeriod: null });
      expect(dingRow.assistedLessons).toHaveLength(1);

      const detail = await (
        await TEACHER_DETAIL(getRequest("/teachers/1?month=2026-10"), routeParams({ id: String(amy.id) }))
      ).json();
      expect(detail.lessons.map((l: { name: string }) => l.name)).toEqual(["Amy 教的"]);
      expect(detail.assistedLessons.map((l: { name: string; status: string }) => [l.name, l.status])).toEqual([
        ["結束的協助", "finished"],
        ["Amy 協助的", "inProgress"],
      ]);
      expect(detail.stats.sessions).toBe(0);
      expect(detail.periods).toEqual([]);

      const res = await DELETE_TEACHER(jsonRequest("DELETE"), routeParams({ id: String(ding.id) }));
      expect(res.status).toBe(409);
      expect(await prisma.teacher.count({ where: { id: ding.id } })).toBe(1);
    });
  });
});
