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

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { POST as checkin } from "@/app/api/liff/checkin/route";
import { GET as today } from "@/app/api/liff/today/route";

function checkinRequest(token: string | null, body: unknown) {
  return new Request("http://test.local/api/liff/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function todayRequest(token: string | null, studentId?: number) {
  const qs = studentId ? `?studentId=${studentId}` : "";
  return new Request(`http://test.local/api/liff/today${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function createPeriod(lessonId: number, start: Date, end: Date) {
  return prisma.lessonPeriod.create({
    data: { lessonId, startTime: start, endTime: end },
  });
}

describe("POST /api/liff/checkin (self check-in)", () => {
  let classroomId: number;
  let studentId: number;
  let cardId: number;
  let lessonId: number;
  let periodId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    const student = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "lineAmy" },
    });
    studentId = student.id;
    const card = await createCard(classroomId, { name: "10 堂卡", sessions: 10 });
    cardId = card.id;
    const { lesson } = await createLesson(classroomId, { cardIds: [cardId] });
    lessonId = lesson.id;
    const now = new Date();
    const period = await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));
    periodId = period.id;
  });

  it("建立 source=STUDENT 紀錄、扣一堂、不設 attendanceTakenAt", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 5, totalSessions: 5 });

    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      periodId,
      status: "checked",
      remainingSessions: 4,
      exhausted: false,
    });

    const record = await prisma.attendanceRecord.findFirst({
      where: { studentId, lessonPeriodId: periodId },
    });
    expect(record?.source).toBe("STUDENT");
    expect(record?.studentCardId).not.toBeNull();

    const period = await prisma.lessonPeriod.findUnique({ where: { id: periodId } });
    expect(period?.attendanceTakenAt).toBeNull();

    const sc = await prisma.studentCard.findFirst({ where: { studentId } });
    expect(sc?.remainingSessions).toBe(4);
  });

  it("用完最後一堂 → exhausted 且建立「課卡使用完畢」Event", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 1, totalSessions: 10 });

    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ status: "checked", remainingSessions: 0, exhausted: true });

    const event = await prisma.event.findFirst({
      where: { studentId, title: "課卡使用完畢" },
    });
    expect(event).not.toBeNull();
  });

  it("沒有可用課卡、也沒選要買的卡 → 400 card_required，不建任何紀錄", async () => {
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("card_required");
    const count = await prisma.attendanceRecord.count({ where: { studentId } });
    expect(count).toBe(0);
  });

  it("多張可用卡、沒指定 → card_required；指定其中一張 → 扣那張", async () => {
    const other = await createCard(classroomId, { name: "5 堂卡", sessions: 5 });
    await prisma.lessonCard.create({ data: { lessonId, cardId: other.id } });
    const a = await createStudentCard(studentId, cardId, { remainingSessions: 3, totalSessions: 10 });
    const b = await createStudentCard(studentId, other.id, { remainingSessions: 5, totalSessions: 5 });

    const res = await checkin(checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("card_required");

    const ok = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], studentCardId: b.id })
    );
    expect(ok.status).toBe(200);
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
    expect(record.studentCardId).toBe(b.id);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } })).remainingSessions).toBe(3);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: b.id } })).remainingSessions).toBe(4);
  });

  it("指定不能用在這堂課的卡 → 400 card_not_usable", async () => {
    const offLesson = await createCard(classroomId, { name: "別堂的卡" });
    const sc = await createStudentCard(studentId, offLesson.id, { remainingSessions: 3 });
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], studentCardId: sc.id })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("card_not_usable");
  });

  it("當場買這堂課的卡 → 建未付款卡並綁這筆出席，回 amountDue 與 unpaidCards", async () => {
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], buyCardId: cardId })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ status: "checked", remainingSessions: 9 });
    expect(body.amountDue).toBe(3000);
    expect(body.unpaidCards).toHaveLength(1);
    expect(body.purchased).toMatchObject({ isPaid: false, finalPrice: 3000 });

    const sc = await prisma.studentCard.findFirstOrThrow({ where: { studentId } });
    expect(sc).toMatchObject({ isPaid: false, purchaseSource: "STUDENT", remainingSessions: 9 });
    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
    expect(record.studentCardId).toBe(sc.id);
  });

  it("體驗卡：新同學照價未付；舊生（買過一般卡）$0 已付", async () => {
    const trial = await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true });
    await prisma.lessonCard.create({ data: { lessonId, cardId: trial.id } });

    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], buyCardId: trial.id })
    );
    const body = await res.json();
    expect(body.amountDue).toBe(400);
    expect(body.purchased).toMatchObject({ isPaid: false, finalPrice: 400 });

    // 舊生
    const old = await createStudent(classroomId, { name: "Old" });
    await prisma.student.update({ where: { id: old.id }, data: { lineUserId: "lineOld" } });
    await createStudentCard(old.id, cardId, { remainingSessions: 0, totalSessions: 10 });
    const res2 = await checkin(
      checkinRequest("lineOld", { studentId: old.id, lessonId, periodIds: [periodId], buyCardId: trial.id })
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(body2.amountDue).toBe(0);
    const oldTrial = await prisma.studentCard.findFirstOrThrow({ where: { studentId: old.id, cardId: trial.id } });
    expect(oldTrial).toMatchObject({ finalPrice: 0, isPaid: true, paidByUserId: null });
  });

  it("買沒掛在這堂課的卡 → 400 card_not_offered；不合格的複習卡 → 403", async () => {
    const elsewhere = await createCard(classroomId, { name: "別的卡" });
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], buyCardId: elsewhere.id })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("card_not_offered");

    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const practice = await createCard(classroomId, {
      name: "複習卡",
      isPracticeCard: true,
      danceStyleId: lesson.danceStyleId,
    });
    await prisma.lessonCard.create({ data: { lessonId, cardId: practice.id } });
    const res2 = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], buyCardId: practice.id })
    );
    expect(res2.status).toBe(403);
    expect(await prisma.studentCard.count({ where: { studentId } })).toBe(0);
  });

  it("兩個時段共用一張只剩 1 堂的卡、又沒別的卡 → card_required，什麼都不寫", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 1, totalSessions: 10 });
    const later = new Date(Date.now() + 2 * 3600_000);
    const p2 = await createPeriod(lessonId, later, new Date(later.getTime() + 3600_000));
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId, p2.id] })
    );
    expect(res.status).toBe(400);
    expect(await prisma.attendanceRecord.count({ where: { studentId } })).toBe(0);
  });

  it("都已簽過 → 不會因為帶了 buyCardId 而多買一張", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 5, totalSessions: 5 });
    await checkin(checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] }));
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId], buyCardId: cardId })
    );
    expect((await res.json()).results[0].status).toBe("already_checked");
    expect(await prisma.studentCard.count({ where: { studentId } })).toBe(1);
  });

  it("重複簽到同一時段 → already_checked，不重建也不重複扣堂", async () => {
    await createStudentCard(studentId, cardId, { remainingSessions: 5, totalSessions: 5 });

    await checkin(checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] }));
    const res2 = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [periodId] })
    );
    const body2 = await res2.json();
    expect(body2.results[0].status).toBe("already_checked");

    const count = await prisma.attendanceRecord.count({
      where: { studentId, lessonPeriodId: periodId },
    });
    expect(count).toBe(1);
    const sc = await prisma.studentCard.findFirst({ where: { studentId } });
    expect(sc?.remainingSessions).toBe(4); // only the first check-in deducted
  });

  it("帶別人的 studentId（lineUserId 不符）→ 403 forbidden", async () => {
    const res = await checkin(
      checkinRequest("lineSomeoneElse", { studentId, lessonId, periodIds: [periodId] })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("periodIds 為空 → 400", async () => {
    const res = await checkin(
      checkinRequest("lineAmy", { studentId, lessonId, periodIds: [] })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/liff/today", () => {
  let classroomId: number;
  let studentId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    const student = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "lineAmy" },
    });
    studentId = student.id;
  });

  it("今天有課 → 回 today 清單，含 alreadyChecked 旗標", async () => {
    const { lesson } = await createLesson(classroomId, { name: "今日課" });
    const now = new Date();
    await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));

    const res = await today(todayRequest("lineAmy", studentId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toHaveLength(1);
    expect(body.today[0].lessonName).toBe("今日課");
    expect(body.today[0].periods[0].alreadyChecked).toBe(false);
    expect(body.nextLesson).toBeNull();
  });

  it("帶學生時回每堂課的卡況：可用卡、自動挑的卡、可買的卡（體驗卡依新舊生定價）", async () => {
    const card = await createCard(classroomId, { name: "10 堂卡", price: 2000, sessions: 10 });
    const trial = await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true });
    const { lesson } = await createLesson(classroomId, { cardIds: [card.id, trial.id] });
    const now = new Date();
    await createPeriod(lesson.id, now, new Date(now.getTime() + 3600_000));

    let body = await (await today(todayRequest("lineAmy", studentId))).json();
    expect(body.today[0].cardStatus).toMatchObject({ usable: [], autoPickId: null });
    expect(body.today[0].cardStatus.buyable.map((c: { name: string; price: number }) => [c.name, c.price])).toEqual([
      ["體驗課", 400],
      ["10 堂卡", 2000],
    ]);

    const sc = await createStudentCard(studentId, card.id, { remainingSessions: 3, totalSessions: 10 });
    body = await (await today(todayRequest("lineAmy", studentId))).json();
    expect(body.today[0].cardStatus.autoPickId).toBe(sc.id);
    expect(body.today[0].cardStatus.usable[0]).toMatchObject({ studentCardId: sc.id, remainingSessions: 3 });
    // 舊生 → 體驗卡 $0
    expect(body.today[0].cardStatus.buyable[0]).toMatchObject({ name: "體驗課", price: 0 });
  });

  it("今天沒課 → today 空、回 nextLesson", async () => {
    const { lesson } = await createLesson(classroomId, { name: "下週課" });
    const future = new Date(Date.now() + 7 * 24 * 3600_000);
    await createPeriod(lesson.id, future, new Date(future.getTime() + 3600_000));

    const res = await today(todayRequest("lineAmy", studentId));
    const body = await res.json();
    expect(body.today).toHaveLength(0);
    expect(body.nextLesson?.lessonName).toBe("下週課");
  });
});
