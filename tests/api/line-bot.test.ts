import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  createLocation,
} from "../factories";
import { handleLineEvent, resolveLineClassroom } from "@/service/lineBot";
import type { LineMessage } from "@/lib/line";

// The bot builds replies from the DB; capture them instead of calling LINE.
let sent: LineMessage[][] = [];
const reply = async (messages: LineMessage[]) => {
  sent.push(messages);
};
const postback = (userId: string, data: string) =>
  handleLineEvent({ type: "postback", replyToken: "r", source: { type: "user", userId }, postback: { data } }, reply);
const text = (userId: string, t: string) =>
  handleLineEvent(
    { type: "message", replyToken: "r", source: { type: "user", userId }, message: { type: "text", id: "1", text: t } },
    reply
  );
const last = () => JSON.stringify(sent.at(-1));

// A Tuesday, 12:00 Taipei; lessons below are later that week.
const NOW = new Date("2026-10-27T04:00:00Z");

async function lessonAt(classroomId: number, iso: string, opts: { name: string; locationId?: number | null }) {
  const { lesson } = await createLesson(classroomId, { name: opts.name, locationId: opts.locationId ?? null });
  const startTime = new Date(iso);
  await prisma.lessonPeriod.create({
    data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
  });
  return lesson;
}

describe("LINE bot — 課表／價目表／我的課卡", () => {
  let classroomId: number;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await resetDb();
    sent = [];
    classroomId = (await createClassroom({ name: "Googoo" })).id;
  });
  afterEach(() => vi.useRealTimers());

  describe("resolveLineClassroom", () => {
    it("bound student → their classroom, even when it isn't public", async () => {
      const s = await createStudent(classroomId);
      await prisma.student.update({ where: { id: s.id }, data: { lineUserId: "Ustu" } });
      expect(await resolveLineClassroom("Ustu")).toEqual({ kind: "classroom", classroomId, via: "student" });
    });

    it("a teacher's old LINE binding no longer picks a classroom (LINE is student-only)", async () => {
      await prisma.user.update({ where: { id: 1 }, data: { lineUserId: "Uteach", currentClassroomId: classroomId } });
      expect(await resolveLineClassroom("Uteach")).toEqual({ kind: "none" });
    });

    it("unbound: nothing public → none; one public → it; several → pick, then remembered", async () => {
      expect(await resolveLineClassroom("Unew")).toEqual({ kind: "none" });

      await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
      expect(await resolveLineClassroom("Unew")).toMatchObject({ kind: "classroom", classroomId, via: "listed" });

      const other = await createClassroom({ name: "Other", email: "o@test.local" });
      await prisma.classroom.update({ where: { id: other.id }, data: { lineListed: true } });
      expect(await resolveLineClassroom("Unew")).toMatchObject({ kind: "pick" });

      await postback("Unew", `a=pick&c=${other.id}&then=prices`);
      expect(await resolveLineClassroom("Unew")).toMatchObject({ kind: "classroom", classroomId: other.id, via: "browse" });
    });

    it("refuses to pick a classroom that isn't public", async () => {
      await postback("Unew", `a=pick&c=${classroomId}`);
      expect(last()).toContain("沒有公開課表");
      expect(await prisma.lineAccount.findUnique({ where: { lineUserId: "Unew" } })).toBeNull();
    });
  });

  describe("課表", () => {
    beforeEach(async () => {
      await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
    });

    it("one location or none → this week's lessons straight away, never another classroom's", async () => {
      await lessonAt(classroomId, "2026-10-28T12:00:00Z", { name: "Bachata 週三" });
      await lessonAt(classroomId, "2026-11-10T12:00:00Z", { name: "下下週" });
      const other = await createClassroom({ name: "Other", email: "o@test.local" });
      await lessonAt(other.id, "2026-10-28T12:00:00Z", { name: "別間的課" });

      await postback("Unew", "a=schedule");
      expect(last()).toContain("Bachata 週三");
      expect(last()).not.toContain("下下週");
      expect(last()).not.toContain("別間的課");
    });

    it("several locations → asks first; then filters by the chosen one", async () => {
      const tainan = await createLocation(classroomId, { name: "台南", address: "台南市東區" });
      const kaohsiung = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });
      await lessonAt(classroomId, "2026-11-01T12:00:00Z", { name: "週日台南", locationId: tainan.id });
      await lessonAt(classroomId, "2026-10-28T12:00:00Z", { name: "週三高雄", locationId: kaohsiung.id });

      await text("Unew", "課表");
      expect(last()).toContain("quickReply");
      expect(last()).toContain(`a=schedule&loc=${tainan.id}`);

      await postback("Unew", `a=schedule&loc=${tainan.id}`);
      expect(last()).toContain("週日台南");
      expect(last()).not.toContain("週三高雄");
      expect(last()).toContain("google.com/maps");

      await postback("Unew", "a=schedule&loc=all");
      expect(last()).toContain("週日台南");
      expect(last()).toContain("週三高雄");
    });

    it("lessons ended by hand are left out", async () => {
      const lesson = await lessonAt(classroomId, "2026-10-28T12:00:00Z", { name: "已結束的課" });
      await prisma.lesson.update({ where: { id: lesson.id }, data: { endedAt: new Date() } });
      await postback("Unew", "a=schedule");
      expect(last()).toContain("未來一週沒有排課");
    });
  });

  it("價目表 groups 課卡 / 體驗課 and leaves out retired cards", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
    await createCard(classroomId, { name: "10 堂卡", price: 4500, sessions: 10 });
    await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true });
    const retired = await createCard(classroomId, { name: "舊卡" });
    await prisma.card.update({ where: { id: retired.id }, data: { expiredAt: new Date() } });

    await postback("Unew", "a=prices");
    expect(last()).toContain("10 堂卡");
    expect(last()).toContain("單堂 $450");
    expect(last()).toContain("體驗課");
    expect(last()).not.toContain("舊卡");
    // Unbound → no buy button.
    expect(last()).not.toContain("購買課卡");
  });

  describe("我的課卡", () => {
    it("unbound → how to bind", async () => {
      await postback("Unew", "a=mycards");
      expect(last()).toContain("還沒有綁定學生身分");
    });

    it("shows only this student's usable or unpaid cards", async () => {
      const card = await createCard(classroomId, { name: "10 堂卡" });
      const me = await createStudent(classroomId, { name: "小美" });
      await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume" } });
      await createStudentCard(me.id, card.id, { remainingSessions: 3, totalSessions: 10 });
      await createStudentCard(me.id, card.id, { remainingSessions: 0, totalSessions: 10 }); // used up, paid
      await createStudentCard(me.id, card.id, { remainingSessions: 4, totalSessions: 4, isPaid: false, finalPrice: 2000 });
      const someoneElse = await createStudent(classroomId, { name: "別人" });
      await createStudentCard(someoneElse.id, card.id, { remainingSessions: 9, totalSessions: 10 });

      await text("Ume", "我的課卡");
      expect(last()).toContain("小美 的課卡");
      expect(last()).toContain("剩 3／10 堂");
      expect(last()).toContain("未付 $2,000");
      expect(last()).not.toContain("剩 9／10 堂");
      expect(last()).not.toContain("已用完");
    });

    it("an archived student looks unbound", async () => {
      const me = await createStudent(classroomId, { name: "小美" });
      await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume", archivedAt: new Date() } });
      await postback("Ume", "a=mycards");
      expect(last()).toContain("還沒有綁定學生身分");
    });
  });

  it("更多 offers 切換教室 to a student bound in several classrooms", async () => {
    const me = await createStudent(classroomId, { name: "小美" });
    await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume" } });
    await postback("Ume", "a=more");
    expect(last()).not.toContain("切換教室");

    const other = await createClassroom({ name: "Other", email: "o2@test.local" });
    const me2 = await createStudent(other.id, { name: "小美" });
    await prisma.student.update({ where: { id: me2.id }, data: { lineUserId: "Ume" } });
    await postback("Ume", "a=more");
    expect(last()).toContain("切換教室");
    expect(last()).toContain("cards?switch=1");
  });

  it("更多 for a bound student: their name, 上課紀錄 with this month's count, 教室地點 — no binding steps", async () => {
    const me = await createStudent(classroomId, { name: "小美" });
    await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume" } });
    await createLocation(classroomId, { name: "台南", address: "台南市中西區民族路 1 號" });
    const lesson = await lessonAt(classroomId, "2026-10-20T11:00:00Z", { name: "上週課" });
    const period = await prisma.lessonPeriod.findFirstOrThrow({ where: { lessonId: lesson.id } });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: me.id } });

    await postback("Ume", "a=more");
    expect(last()).toContain("小美 · Googoo");
    expect(last()).toContain("cards?tab=attend");
    expect(last()).toContain("這個月上了 1 堂");
    expect(last()).toContain("教室地點");
    expect(last()).not.toContain("第一次來上課");
  });

  it("更多 for an unbound account: the two ways to bind, plus the public classroom's 教室地點", async () => {
    await postback("Unew", "a=more");
    expect(last()).toContain("第一次來上課");
    expect(last()).toContain("已經在上課了");
    expect(last()).not.toContain("教室地點"); // no public classroom to show yet

    await prisma.classroom.update({ where: { id: classroomId }, data: { lineListed: true } });
    await createLocation(classroomId, { name: "高雄" });
    await postback("Unew", "a=more");
    expect(last()).toContain("教室地點");
  });

  it("教室地點 lists each 分部; one with an address opens Google Maps", async () => {
    const me = await createStudent(classroomId, { name: "小美" });
    await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume" } });
    await text("Ume", "地點");
    expect(last()).toContain("還沒有設定教室地點");

    await createLocation(classroomId, { name: "台南", address: "台南市中西區民族路 1 號", sortOrder: 0 });
    await createLocation(classroomId, { name: "高雄", sortOrder: 1 });
    await createLocation(classroomId, { name: "舊址", archivedAt: new Date() });
    await postback("Ume", "a=locations");
    expect(last()).toContain("台南市中西區民族路 1 號");
    expect(last()).toContain("google.com/maps");
    expect(last()).toContain("高雄");
    expect(last()).not.toContain("舊址");
  });

  it("follow: a bound student is greeted by name; a stranger is told how to register", async () => {
    const follow = (userId: string) =>
      handleLineEvent({ type: "follow", replyToken: "r", source: { type: "user", userId } }, reply);
    await follow("Unew");
    expect(last()).toContain("掃門口的簽到 QR Code");

    const me = await createStudent(classroomId, { name: "小美" });
    await prisma.student.update({ where: { id: me.id }, data: { lineUserId: "Ume" } });
    await follow("Ume");
    expect(last()).toContain("小美，歡迎");
    expect(last()).toContain("Googoo");
  });

  it("an unbound stranger's message gets help + quick replies instead of an error", async () => {
    await text("Unew", "hi");
    expect(last()).toContain("還沒有綁定學生身分也可以看課表");
    expect(last()).toContain("a=schedule");
  });
});
