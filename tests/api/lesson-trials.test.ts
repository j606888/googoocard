import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/lessons/[id]/trials/route";
import { takeAttendance } from "@/domains/attendance/attendance.service";

const get = (lessonId: number) =>
  GET(new Request(`http://test.local/api/lessons/${lessonId}/trials`), routeParams({ id: String(lessonId) }));

const post = (lessonId: number, body: unknown) =>
  POST(
    new Request(`http://test.local/api/lessons/${lessonId}/trials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    routeParams({ id: String(lessonId) })
  );

// 體驗名單：老師在體驗課的課程頁登記（上課前收費），點名時優先扣那張體驗卡。
describe("/api/lessons/[id]/trials", () => {
  let classroomId: number;
  let trialId: number;
  let generalId: number;
  let lessonId: number;
  let periodId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    trialId = (await createCard(classroomId, { name: "體驗課", price: 400, sessions: 1, isTrial: true })).id;
    generalId = (await createCard(classroomId, { name: "8 堂", price: 3200, sessions: 8 })).id;
    const { lesson, period } = await createLesson(classroomId, {
      cardIds: [trialId, generalId],
      withPeriod: true,
    });
    lessonId = lesson.id;
    periodId = period!.id;
  });

  it("新名字：建學生、照牌價、當場記收款（現金、收款人是自己）", async () => {
    const res = await post(lessonId, {
      newStudentName: "小美",
      cardId: trialId,
      isPaid: true,
      paymentMethod: "CASH",
    });
    expect(res.status).toBe(200);
    const { studentId, studentCardId } = await res.json();

    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    expect(student).toMatchObject({ name: "小美", classroomId });
    const sc = await prisma.studentCard.findUniqueOrThrow({ where: { id: studentCardId } });
    expect(sc).toMatchObject({
      finalPrice: 400,
      isPaid: true,
      paymentMethod: "CASH",
      paidByUserId: auth.userId,
      purchaseSource: "STAFF",
      remainingSessions: 1,
    });
  });

  it("舊生（買過一般卡）預設 $0、已付；還沒收錢的新同學就是待付款", async () => {
    const old = await createStudent(classroomId, { name: "老鳥" });
    await createStudentCard(old.id, generalId, { remainingSessions: 0 });
    const res = await post(lessonId, { studentId: old.id, cardId: trialId, isPaid: false });
    const sc = await prisma.studentCard.findUniqueOrThrow({ where: { id: (await res.json()).studentCardId } });
    expect(sc).toMatchObject({ finalPrice: 0, isPaid: true, paymentMethod: null, paidByUserId: null });

    const res2 = await post(lessonId, { newStudentName: "新人", cardId: trialId, isPaid: false });
    const sc2 = await prisma.studentCard.findUniqueOrThrow({ where: { id: (await res2.json()).studentCardId } });
    expect(sc2).toMatchObject({ finalPrice: 400, isPaid: false });
  });

  it("老師可以改價（例如朋友價）", async () => {
    const res = await post(lessonId, { newStudentName: "朋友", cardId: trialId, finalPrice: 200, isPaid: true });
    const sc = await prisma.studentCard.findUniqueOrThrow({ where: { id: (await res.json()).studentCardId } });
    expect(sc.finalPrice).toBe(200);
  });

  it("不是這堂課的體驗卡 → 400；同一人重複登記 → 400；別間教室的課 → 404", async () => {
    expect((await post(lessonId, { newStudentName: "A", cardId: generalId, isPaid: true })).status).toBe(400);

    const amy = await createStudent(classroomId, { name: "Amy" });
    expect((await post(lessonId, { studentId: amy.id, cardId: trialId, isPaid: true })).status).toBe(200);
    const again = await post(lessonId, { studentId: amy.id, cardId: trialId, isPaid: true });
    expect(again.status).toBe(400);

    const other = await createClassroom({ email: "other@test.local" });
    const { lesson: foreign } = await createLesson(other.id, { cardIds: [] });
    expect((await post(foreign.id, { newStudentName: "B", cardId: trialId, isPaid: true })).status).toBe(404);
  });

  it("studentId 與 newStudentName 要二擇一", async () => {
    const amy = await createStudent(classroomId, { name: "Amy" });
    expect((await post(lessonId, { cardId: trialId, isPaid: true })).status).toBe(400);
    expect(
      (await post(lessonId, { studentId: amy.id, newStudentName: "Amy", cardId: trialId, isPaid: true })).status
    ).toBe(400);
  });

  it("GET：已報名的在前，點名用掉後變成已上課", async () => {
    const res = await post(lessonId, { newStudentName: "小美", cardId: trialId, isPaid: true });
    const { studentId } = await res.json();

    let body = await (await get(lessonId)).json();
    expect(body.trialCards).toEqual([{ id: trialId, name: "體驗課", price: 400 }]);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({ status: "registered", student: { name: "小美" }, isPaid: true });

    await takeAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [studentId] });

    body = await (await get(lessonId)).json();
    expect(body.entries[0]).toMatchObject({ status: "attended" });
    expect(body.entries[0].attendedAt).not.toBeNull();
  });

  it("沒掛體驗卡的課 → 空名單", async () => {
    const { lesson } = await createLesson(classroomId, { cardIds: [generalId] });
    const body = await (await get(lesson.id)).json();
    expect(body).toEqual({ trialCards: [], entries: [] });
  });

  it("點名時：舊生同時有一般卡，也會優先扣登記的體驗卡（不變成多張卡待選）", async () => {
    const old = await createStudent(classroomId, { name: "老鳥" });
    const general = await createStudentCard(old.id, generalId, { remainingSessions: 5, totalSessions: 8 });
    const res = await post(lessonId, { studentId: old.id, cardId: trialId, isPaid: true });
    const { studentCardId } = await res.json();

    await takeAttendance({ lessonId, lessonPeriodId: periodId, studentIds: [old.id] });

    const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: old.id } });
    expect(record.studentCardId).toBe(studentCardId);
    const untouched = await prisma.studentCard.findUniqueOrThrow({ where: { id: general.id } });
    expect(untouched.remainingSessions).toBe(5);
  });
});
