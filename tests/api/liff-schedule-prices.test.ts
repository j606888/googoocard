import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, createCard, createLesson, createLocation } from "../factories";

// The token string IS the lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/line")>()),
  verifyIdToken: async (token: string) => (token && token !== "bad" ? { userId: token } : null),
}));

import { GET as getSchedule } from "@/app/api/liff/schedule/route";
import { GET as getPrices } from "@/app/api/liff/prices/route";

const req = (path: string, token: string, params: Record<string, string | number> = {}) =>
  new Request(`http://test.local${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

async function periodAt(lessonId: number, iso: string) {
  const startTime = new Date(iso);
  return prisma.lessonPeriod.create({
    data: { lessonId, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
  });
}

describe("LIFF 課表／課卡方案", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom({ name: "Googoo" })).id;
  });

  describe("classroom resolution", () => {
    it("unbound visitor, nothing public → 404 no_public_classroom", async () => {
      const res = await getPrices(req("/api/liff/prices", "Uvisitor"));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("no_public_classroom");
    });

    it("unbound visitor sees the only public classroom", async () => {
      await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
      await createCard(classroomId, { name: "10 堂卡" });
      const res = await getPrices(req("/api/liff/prices", "Uvisitor"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.classroom).toEqual({ id: classroomId, name: "Googoo" });
      expect(body.cards.map((c: { name: string }) => c.name)).toEqual(["10 堂卡"]);
    });

    it("several public → 409 with choices; picking one is remembered for the bot", async () => {
      const other = await createClassroom({ name: "Other", email: "o2@test.local" });
      await prisma.classroom.updateMany({ data: { lineListed: true } });
      const res = await getPrices(req("/api/liff/prices", "Uvisitor"));
      expect(res.status).toBe(409);
      expect((await res.json()).classrooms).toHaveLength(2);

      const picked = await getPrices(req("/api/liff/prices", "Uvisitor", { classroomId: other.id }));
      expect(picked.status).toBe(200);
      expect((await picked.json()).classrooms).toHaveLength(2); // still switchable
      const account = await prisma.lineAccount.findUnique({ where: { lineUserId: "Uvisitor" } });
      expect(account?.browseClassroomId).toBe(other.id);
    });

    it("a private classroom can't be picked by id", async () => {
      const res = await getPrices(req("/api/liff/prices", "Uvisitor", { classroomId }));
      expect(res.status).toBe(404);
    });

    it("studentId must be the caller's own", async () => {
      const mine = await createStudent(classroomId, { name: "Mine" });
      const other = await createStudent(classroomId, { name: "Other" });
      await prisma.student.update({ where: { id: mine.id }, data: { lineUserId: "Ume" } });
      await prisma.student.update({ where: { id: other.id }, data: { lineUserId: "Uother" } });
      expect((await getPrices(req("/api/liff/prices", "Ume", { studentId: other.id }))).status).toBe(403);
      expect((await getPrices(req("/api/liff/prices", "Ume", { studentId: mine.id }))).status).toBe(200);
      expect((await getPrices(req("/api/liff/prices", "bad", { studentId: mine.id }))).status).toBe(401);
    });
  });

  it("prices list active cards including trial, never archived ones", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
    await createCard(classroomId, { name: "體驗課", isTrial: true, price: 300, sessions: 1 });
    const gone = await createCard(classroomId, { name: "下架卡" });
    await prisma.card.update({ where: { id: gone.id }, data: { expiredAt: new Date() } });
    const body = await (await getPrices(req("/api/liff/prices", "Uvisitor"))).json();
    expect(body.cards.map((c: { name: string; isTrial: boolean }) => [c.name, c.isTrial])).toEqual([["體驗課", true]]);
  });

  describe("schedule", () => {
    it("returns the month's periods with style, level, teachers and 分部; hides those after a manual end", async () => {
      await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
      const loc = await createLocation(classroomId, { name: "高雄" });
      const { lesson } = await createLesson(classroomId, { name: "Salsa 中階", locationId: loc.id, level: 2 });
      await periodAt(lesson.id, "2026-10-27T12:00:00Z");
      await periodAt(lesson.id, "2026-11-03T12:00:00Z"); // next month
      const { lesson: ended } = await createLesson(classroomId, { name: "結束的課" });
      await periodAt(ended.id, "2026-10-01T12:00:00Z");
      await periodAt(ended.id, "2026-10-20T12:00:00Z");
      await prisma.lesson.update({ where: { id: ended.id }, data: { endedAt: new Date("2026-10-10T00:00:00Z") } });

      const res = await getSchedule(req("/api/liff/schedule", "Uvisitor", { month: "2026-10" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.month).toBe("2026-10");
      expect(body.periods.map((p: { lessonName: string; startTime: string }) => [p.lessonName, p.startTime])).toEqual([
        ["結束的課", "2026-10-01T12:00:00.000Z"],
        ["Salsa 中階", "2026-10-27T12:00:00.000Z"],
      ]);
      expect(body.periods[1].location).toEqual({ id: loc.id, name: "高雄" });
      expect(body.danceStyles.length).toBeGreaterThan(0);
      expect(body.myLessonIds).toEqual([]);
    });

    it("a bound student gets myLessonIds", async () => {
      const student = await createStudent(classroomId);
      await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "Ume" } });
      const { lesson } = await createLesson(classroomId, { name: "我的課" });
      await createLesson(classroomId, { name: "別人的課" });
      await prisma.lessonStudent.create({ data: { lessonId: lesson.id, studentId: student.id } });

      const body = await (await getSchedule(req("/api/liff/schedule", "Ume", { studentId: student.id }))).json();
      expect(body.myLessonIds).toEqual([lesson.id]);
    });

    it("ignores a malformed month", async () => {
      await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
      const body = await (await getSchedule(req("/api/liff/schedule", "Uvisitor", { month: "2026-13" }))).json();
      expect(body.month).toMatch(/^\d{4}-\d{2}$/);
      expect(body.month).not.toBe("2026-13");
    });
  });
});
