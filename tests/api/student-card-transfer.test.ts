import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  jsonRequest,
  routeParams,
  createDanceStyles,
  type DanceStyleIds,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/students/[id]/student-cards/[studentCardId]/transfer/route";
import { DELETE } from "@/app/api/students/[id]/student-cards/[studentCardId]/route";

function transfer(studentId: number, studentCardId: number, body: { toStudentId: number; note?: string }) {
  return POST(
    jsonRequest("POST", body),
    routeParams({ id: String(studentId), studentCardId: String(studentCardId) })
  );
}

let S: DanceStyleIds;

describe("POST /api/students/[id]/student-cards/[studentCardId]/transfer", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
  });

  it("剩餘堂數整批給對方：新卡同卡種、帶走剩餘價值；舊卡結束並連到新卡", async () => {
    const from = await createStudent(classroomId, { name: "陳小華" });
    const to = await createStudent(classroomId, { name: "李彥增" });
    const card = await createCard(classroomId, { name: "一般課卡 10 堂", sessions: 10, price: 3500 });
    // 10 堂 3500 → 單堂 350，用掉 6 堂剩 4 堂 = 1400
    const sc = await createStudentCard(from.id, card.id, {
      totalSessions: 10,
      remainingSessions: 4,
      finalPrice: 3500,
    });

    const res = await transfer(from.id, sc.id, { toStudentId: to.id, note: "搬去台北" });
    expect(res.status).toBe(200);
    const created = await res.json();

    expect(created.studentId).toBe(to.id);
    expect(created.cardId).toBe(card.id);
    expect(created.origin).toBe("TRANSFER");
    expect(created.totalSessions).toBe(4);
    expect(created.remainingSessions).toBe(4);
    expect(created.finalPrice).toBe(1400);
    expect(created.basePrice).toBe(1400);
    expect(created.serialNumber).toBe(sc.serialNumber + 1);
    // 不進未付款清單，但沒有人收到錢
    expect(created.isPaid).toBe(true);
    expect(created.paidByUserId).toBeNull();
    expect(created.note).toBe("搬去台北");

    const old = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(old.expiredAt).not.toBeNull();
    expect(old.transferredToId).toBe(created.id);
    expect(old.remainingSessions).toBe(4); // 不歸零：「轉讓了幾堂」就是它
    expect(old.note).toBe("搬去台北");

    const events = await prisma.event.findMany({ where: { title: "課卡轉讓" }, orderBy: { studentId: "asc" } });
    expect(events.map((e) => e.studentId).sort()).toEqual([from.id, to.id].sort());
  });

  it("轉讓來的卡不算課卡營收，也不算下課對帳的收款", async () => {
    const from = await createStudent(classroomId);
    const to = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(from.id, card.id, { remainingSessions: 3 });
    await transfer(from.id, sc.id, { toStudentId: to.id });

    const { GET } = await import("@/app/api/cards/route");
    const cards = await (await GET(new Request("http://localhost/api/cards"), routeParams({}))).json();
    const row = [...cards.activeCards, ...(cards.archivedCards ?? [])].find((c: { id: number }) => c.id === card.id);
    expect(row.totalRevenue).toBe(3000);
  });

  it("未付款的卡不能轉讓 → 400", async () => {
    const from = await createStudent(classroomId);
    const to = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(from.id, card.id, { isPaid: false });

    const res = await transfer(from.id, sc.id, { toStudentId: to.id });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CARD_UNPAID");
  });

  it("已結束、用完、體驗卡、轉給自己 → 400", async () => {
    const from = await createStudent(classroomId);
    const to = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const trial = await createCard(classroomId, { name: "體驗", isTrial: true, price: 0, sessions: 1 });

    const used = await createStudentCard(from.id, card.id, { remainingSessions: 0 });
    expect((await transfer(from.id, used.id, { toStudentId: to.id })).status).toBe(400);

    const trialCard = await createStudentCard(from.id, trial.id, { totalSessions: 1, remainingSessions: 1, finalPrice: 0 });
    expect((await (await transfer(from.id, trialCard.id, { toStudentId: to.id })).json()).code).toBe("CARD_TRIAL");

    const ok = await createStudentCard(from.id, card.id);
    expect((await (await transfer(from.id, ok.id, { toStudentId: from.id })).json()).code).toBe("SAME_STUDENT");

    // 同一張卡轉第二次
    expect((await transfer(from.id, ok.id, { toStudentId: to.id })).status).toBe(200);
    expect((await transfer(from.id, ok.id, { toStudentId: to.id })).status).toBe(400);
  });

  it("別的教室的學生、封存的學生 → 擋", async () => {
    const from = await createStudent(classroomId);
    const archived = await createStudent(classroomId);
    await prisma.student.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const stranger = await createStudent(other.id);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(from.id, card.id);

    expect((await transfer(from.id, sc.id, { toStudentId: stranger.id })).status).toBe(404);
    expect((await (await transfer(from.id, sc.id, { toStudentId: archived.id })).json()).code).toBe(
      "STUDENT_ARCHIVED"
    );
    const unchanged = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(unchanged.expiredAt).toBeNull();
  });

  it("別的教室的卡 → 404", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const otherStudent = await createStudent(other.id);
    const otherCard = await createCard(other.id);
    const sc = await createStudentCard(otherStudent.id, otherCard.id);
    const to = await createStudent(classroomId);

    expect((await transfer(otherStudent.id, sc.id, { toStudentId: to.id })).status).toBe(404);
  });

  it("複習卡：接收的人沒有該舞種資格 → 403；有資格 → 可以", async () => {
    const from = await createStudent(classroomId, { qualifications: [S.BACHATA] });
    const unqualified = await createStudent(classroomId, { qualifications: [S.SALSA] });
    const qualified = await createStudent(classroomId, { qualifications: [S.BACHATA] });
    const practice = await createCard(classroomId, {
      name: "Bachata 複習卡",
      sessions: 4,
      isPracticeCard: true,
      danceStyleId: S.BACHATA,
    });
    const sc = await createStudentCard(from.id, practice.id, { totalSessions: 4, remainingSessions: 3 });

    expect((await transfer(from.id, sc.id, { toStudentId: unqualified.id })).status).toBe(403);
    expect((await transfer(from.id, sc.id, { toStudentId: qualified.id })).status).toBe(200);
  });

  it("轉讓鏈上的兩張卡都不能刪", async () => {
    const from = await createStudent(classroomId);
    const to = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(from.id, card.id);
    const created = await (await transfer(from.id, sc.id, { toStudentId: to.id })).json();

    const del = (studentId: number, id: number) =>
      DELETE(new Request("http://localhost", { method: "DELETE" }), {
        params: Promise.resolve({ id: String(studentId), studentCardId: String(id) }),
      });
    expect((await del(from.id, sc.id)).status).toBe(400);
    expect((await del(to.id, created.id)).status).toBe(400);
  });
});
