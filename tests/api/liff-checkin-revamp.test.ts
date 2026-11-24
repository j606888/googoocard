import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
} from "../factories";

// Token string IS the lineUserId; the LINE display name is「LINE-<token>」.
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token, name: `LINE-${token}` } : null,
}));

import { POST as checkin } from "@/app/api/liff/checkin/route";
import { GET as today } from "@/app/api/liff/today/route";
import { GET as claimGet } from "@/app/api/liff/claim/route";

const KEY = "wallKey123";

const post = (token: string, body: unknown) =>
  new Request("http://test.local/api/liff/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const get = (url: string, token: string) =>
  new Request(`http://test.local${url}`, { headers: { Authorization: `Bearer ${token}` } });

async function periodNow(lessonId: number, offsetMinutes = 0) {
  const start = new Date(Date.now() + offsetMinutes * 60_000);
  return prisma.lessonPeriod.create({
    data: { lessonId, startTime: start, endTime: new Date(start.getTime() + 3600_000) },
  });
}

describe("LIFF 簽到改版", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: KEY } });
  });

  describe("下課問老師（later）＋ 備註", () => {
    let studentId: number;
    let lessonId: number;
    let periodId: number;

    beforeEach(async () => {
      const student = await createStudent(classroomId, { name: "Amy" });
      await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "lineAmy" } });
      studentId = student.id;
      const card = await createCard(classroomId, { name: "10 堂卡", sessions: 10 });
      const { lesson } = await createLesson(classroomId, { cardIds: [card.id] });
      lessonId = lesson.id;
      periodId = (await periodNow(lesson.id)).id;
    });

    it("沒卡也能簽到：不扣卡、不收單堂、留下備註，記成 no_card 待老師處理", async () => {
      const res = await checkin(
        post("lineAmy", { studentId, lessonId, periodIds: [periodId], later: true, note: "  想報整期，下課付現  " })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toEqual([{ periodId, status: "no_card" }]);
      expect(body.amountDue).toBe(0);
      expect(body.purchased).toBeNull();

      const record = await prisma.attendanceRecord.findFirstOrThrow({
        where: { studentId, lessonPeriodId: periodId },
        include: { dropInCharge: true },
      });
      expect(record.source).toBe("STUDENT");
      expect(record.studentCardId).toBeNull();
      expect(record.dropInCharge).toBeNull();
      expect(record.studentNote).toBe("想報整期，下課付現");
      expect(await prisma.studentCard.count({ where: { studentId } })).toBe(0);
    });

    it("沒選 later 時照舊 card_required，什麼都不寫", async () => {
      const res = await checkin(post("lineAmy", { studentId, lessonId, periodIds: [periodId], note: "hi" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("card_required");
      expect(await prisma.attendanceRecord.count()).toBe(0);
    });

    it("later 時手上的卡也不扣（老師決定）", async () => {
      const card = await prisma.card.findFirstOrThrow({ where: { classroomId } });
      await createStudentCard(studentId, card.id, { remainingSessions: 3, totalSessions: 10 });
      const res = await checkin(post("lineAmy", { studentId, lessonId, periodIds: [periodId], later: true }));
      expect((await res.json()).results[0].status).toBe("no_card");
      const sc = await prisma.studentCard.findFirstOrThrow({ where: { studentId } });
      expect(sc.remainingSessions).toBe(3);
    });

    it("備註最多 200 字，空白不存；用卡簽到也能留話", async () => {
      const card = await prisma.card.findFirstOrThrow({ where: { classroomId } });
      await createStudentCard(studentId, card.id, { remainingSessions: 3, totalSessions: 10 });
      await checkin(post("lineAmy", { studentId, lessonId, periodIds: [periodId], note: "啊".repeat(250) }));
      const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
      expect(record.studentNote).toHaveLength(200);
      expect(record.studentCardId).not.toBeNull();

      const other = await periodNow(lessonId, 30);
      await checkin(post("lineAmy", { studentId, lessonId, periodIds: [other.id], note: "   " }));
      const second = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: other.id } });
      expect(second.studentNote).toBeNull();
    });
  });

  it("今天有課時也回「我的課」：還沒上完的整期＋能用或未付的課卡", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "lineAmy" } });
    const card = await createCard(classroomId, { name: "10 堂卡", sessions: 10 });
    await createStudentCard(student.id, card.id, { remainingSessions: 4, totalSessions: 10 });
    const { lesson } = await createLesson(classroomId, { name: "Bachata Lv1-1", cardIds: [card.id] });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { termPrice: 1600, termSessions: 3 } });
    await periodNow(lesson.id);
    await periodNow(lesson.id, 7 * 24 * 60);
    await prisma.lessonEnrollment.create({
      data: { lessonId: lesson.id, studentId: student.id, price: 1600, sessions: 3 },
    });
    // 已經上完（每堂都點過名）的整期不列。
    const { lesson: done } = await createLesson(classroomId, { name: "舊的一期" });
    await prisma.lesson.update({ where: { id: done.id }, data: { termPrice: 800, termSessions: 1 } });
    const past = await periodNow(done.id, -3 * 24 * 60);
    await prisma.lessonPeriod.update({ where: { id: past.id }, data: { attendanceTakenAt: new Date() } });
    await prisma.lessonEnrollment.create({
      data: { lessonId: done.id, studentId: student.id, price: 800, sessions: 1 },
    });

    const res = await today(get(`/api/liff/today?studentId=${student.id}`, "lineAmy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toHaveLength(1);
    expect(body.myTerms).toEqual([
      expect.objectContaining({
        lessonId: lesson.id,
        lessonName: "Bachata Lv1-1",
        sessions: 3,
        // 只排了 2 個時段：statuses 只到排好的那幾堂（畫面補成 3 格）。
        statuses: ["upcoming", "upcoming"],
      }),
    ]);
    expect(body.myCards).toEqual([expect.objectContaining({ name: "10 堂卡", remainingSessions: 4 })]);
  });

  describe("這是你嗎？（GET /api/liff/claim?suggest=1）", () => {
    const suggest = (token: string) => claimGet(get(`/api/liff/claim?key=${KEY}&suggest=1`, token));

    it("列今天課程已報名（整期、體驗）且沒綁 LINE 的人，並標出最像 LINE 名稱的那位", async () => {
      const trialCard = await createCard(classroomId, { name: "體驗課", sessions: 1, price: 300, isTrial: true });
      const { lesson } = await createLesson(classroomId, { name: "Bachata Lv1-1", cardIds: [trialCard.id] });
      await prisma.lesson.update({ where: { id: lesson.id }, data: { termPrice: 1600, termSessions: 5 } });
      await periodNow(lesson.id);

      const mei = await createStudent(classroomId, { name: "Mei" });
      const zhe = await createStudent(classroomId, { name: "阿哲" });
      const bound = await createStudent(classroomId, { name: "Bound" });
      await prisma.student.update({ where: { id: bound.id }, data: { lineUserId: "Uother" } });
      const archived = await createStudent(classroomId, { name: "Archived" });
      await prisma.student.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
      for (const s of [mei, bound, archived]) {
        await prisma.lessonEnrollment.create({ data: { lessonId: lesson.id, studentId: s.id, price: 1600, sessions: 5 } });
      }
      await createStudentCard(zhe.id, trialCard.id, { remainingSessions: 1, totalSessions: 1 });
      // 用掉的體驗卡（已上過）不算報名。
      const used = await createStudent(classroomId, { name: "Used" });
      await createStudentCard(used.id, trialCard.id, { remainingSessions: 0, totalSessions: 1 });
      // 沒報名的學生、明天的課都不列。
      await createStudent(classroomId, { name: "Walker" });
      const { lesson: tomorrow } = await createLesson(classroomId, { name: "Tomorrow" });
      await periodNow(tomorrow.id, 24 * 60 + 60);

      const res = await suggest("Mei");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.groups).toHaveLength(1);
      expect(body.groups[0]).toMatchObject({ lessonId: lesson.id, lessonName: "Bachata Lv1-1" });
      expect(body.groups[0].students.map((s: { name: string; kind: string }) => [s.name, s.kind])).toEqual([
        ["阿哲", "trial"],
        ["Mei", "term"],
      ]);
      expect(body.bestMatchId).toBe(mei.id);

      // LINE 名稱對不上任何人 → 不猜。
      expect((await (await suggest("Zed")).json()).bestMatchId).toBeNull();
    });

    it("今天沒有人報名 → 空的（畫面退回「第一次來嗎？」）", async () => {
      const { lesson } = await createLesson(classroomId);
      await periodNow(lesson.id);
      const body = await (await suggest("Mei")).json();
      expect(body).toEqual({ groups: [], bestMatchId: null });
    });

    it("要有效的 LINE token 和教室 key", async () => {
      expect((await suggest("bad")).status).toBe(401);
      expect((await claimGet(get(`/api/liff/claim?key=nope&suggest=1`, "Mei"))).status).toBe(404);
    });
  });
});
