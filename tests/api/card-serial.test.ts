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
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as BUY } from "@/app/api/students/[id]/student-cards/route";
import { POST as CONVERT } from "@/app/api/students/[id]/student-cards/[studentCardId]/convert/route";
import { GET as LIST } from "@/app/api/students/route";
import { GET as DETAIL } from "@/app/api/students/[id]/route";

// A second classroom (own owner — createClassroom() hardcodes one email).
async function createOtherClassroom() {
  const user = await prisma.user.create({
    data: { email: "other@test.local", name: "Other", password: "x" },
  });
  return prisma.classroom.create({
    data: { ownerId: user.id, name: "Other Classroom" },
  });
}

async function buy(studentId: number, cardId: number) {
  const res = await BUY(
    jsonRequest("POST", { cardId, sessions: 6, price: 3000 }),
    routeParams({ id: String(studentId) })
  );
  expect(res.status).toBe(200);
  return res.json();
}

function search(query: string) {
  return LIST(
    new Request(`http://test.local/api/students?query=${encodeURIComponent(query)}`, {
      method: "GET",
    })
  );
}

describe("課卡編號 (每教室從 #A0001 開始)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
  });

  it("買卡依序發號，跨學生共用同一個教室計數器", async () => {
    const a = await createStudent(classroomId, { name: "A" });
    const b = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId);

    expect((await buy(a.id, card.id)).serialNumber).toBe(1);
    expect((await buy(b.id, card.id)).serialNumber).toBe(2);
    expect((await buy(a.id, card.id)).serialNumber).toBe(3);
  });

  it("不同教室各自從 1 開始", async () => {
    const other = await createOtherClassroom();
    const otherStudent = await createStudent(other.id);
    const otherCard = await createCard(other.id);
    await createStudentCard(otherStudent.id, otherCard.id);
    await createStudentCard(otherStudent.id, otherCard.id);

    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    expect((await buy(student.id, card.id)).serialNumber).toBe(1);
  });

  it("併發買卡不會撞號", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);

    const created = await Promise.all(Array.from({ length: 6 }, () => buy(student.id, card.id)));
    const serials = created.map((c: { serialNumber: number }) => c.serialNumber).sort((x, y) => x - y);
    expect(serials).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("學生搜尋可以用卡號（含 # 與小寫），也找得到已結束的卡", async () => {
    const holder = await createStudent(classroomId, { name: "持卡人" });
    const other = await createStudent(classroomId, { name: "路人" });
    const card = await createCard(classroomId);
    await createStudentCard(other.id, card.id); // #A0001
    const sc = await createStudentCard(holder.id, card.id); // #A0002
    await prisma.studentCard.update({ where: { id: sc.id }, data: { expiredAt: new Date() } });

    for (const query of ["A0002", "#a0002"]) {
      const body = await (await search(query)).json();
      expect(body.map((s: { name: string }) => s.name)).toEqual(["持卡人"]);
    }
    expect(await (await search("A0099")).json()).toEqual([]);
    // 一般姓名搜尋照舊
    expect((await (await search("路")).json()).map((s: { name: string }) => s.name)).toEqual(["路人"]);
  });

  it("卡號搜尋不會找到別間教室的卡", async () => {
    const other = await createOtherClassroom();
    const otherStudent = await createStudent(other.id, { name: "別人" });
    await createStudentCard(otherStudent.id, (await createCard(other.id)).id); // 別間的 #A0001

    expect(await (await search("A0001")).json()).toEqual([]);
  });

  it("學生詳情帶回編號與雙向的轉換鏈", async () => {
    const student = await createStudent(classroomId);
    const level1 = await createCard(classroomId, { name: "Level 1" });
    const level2 = await createCard(classroomId, { name: "Level 2" });
    const sc = await createStudentCard(student.id, level1.id, { remainingSessions: 4 });

    const converted = await (
      await CONVERT(
        jsonRequest("POST", { targetCardId: level2.id }),
        routeParams({ id: String(student.id), studentCardId: String(sc.id) })
      )
    ).json();

    const res = await DETAIL(new Request("http://test.local/api"), routeParams({ id: String(student.id) }));
    const body = await res.json();
    const byId = new Map(body.studentCards.map((c: { id: number }) => [c.id, c]));

    expect(byId.get(sc.id)).toMatchObject({
      serialNumber: 1,
      convertedTo: { id: converted.id, serialNumber: 2, totalSessions: 4, card: { name: "Level 2" } },
      convertedFrom: [],
    });
    expect(byId.get(converted.id)).toMatchObject({
      serialNumber: 2,
      convertedTo: null,
      convertedFrom: [{ id: sc.id, serialNumber: 1, remainingSessions: 4, card: { name: "Level 1" } }],
    });
  });
});
