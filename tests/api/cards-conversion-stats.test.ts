import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as listGET } from "@/app/api/cards/route";
import { GET as detailGET } from "@/app/api/cards/[id]/route";

// 轉換而來的課卡 (origin = CONVERSION) 沒有新金流 — 它繼承舊卡的剩餘價值。
// 計進卡片營收/購買人次會讓同一筆錢在舊卡與新卡各算一次。但它確實是一張
// 有效的持卡，所以 activeHolders 要算。
describe("卡片統計排除轉換卡", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("列表：totalRevenue 與 purchasedCount 排除轉換卡，activeHolders 包含", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "進階6堂", price: 2000 });

    await createStudentCard(student.id, card.id, {
      finalPrice: 2000,
      remainingSessions: 6,
    });
    await createStudentCard(student.id, card.id, {
      finalPrice: 1133,
      remainingSessions: 4,
      origin: "CONVERSION",
    });

    const body = await (await listGET()).json();
    const found = body.activeCards.find((c: { name: string }) => c.name === "進階6堂");

    expect(found.totalRevenue).toBe(2000); // 不含轉換卡的 1133
    expect(found.purchasedCount).toBe(1); // 只算真的買的那張
    expect(found.activeHolders).toBe(2); // 兩張都還有剩餘堂數
  });

  it("明細頁：同口徑排除，holders 仍列出轉換卡", async () => {
    const student = await createStudent(classroomId, { name: "小明" });
    const card = await createCard(classroomId, { name: "進階單堂", price: 350 });

    await createStudentCard(student.id, card.id, {
      finalPrice: 350,
      totalSessions: 1,
      remainingSessions: 1,
    });
    await createStudentCard(student.id, card.id, {
      finalPrice: 167,
      totalSessions: 1,
      remainingSessions: 1,
      origin: "CONVERSION",
    });

    const request = new Request("http://test.local/api/cards/1", { method: "GET" });
    const res = await detailGET(request, routeParams({ id: String(card.id) }));
    const body = await res.json();

    expect(body.totalRevenue).toBe(350);
    expect(body.purchasedCount).toBe(1);
    // 持卡人清單是「誰手上還有卡」，轉換卡要看得到
    expect(body.activeHolderCount).toBe(2);
    expect(body.holders).toHaveLength(2);
  });

  it("沒有轉換卡時，統計與過去完全相同（修正為 no-op）", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡", price: 3000 });
    await createStudentCard(student.id, card.id, { finalPrice: 3000, remainingSessions: 6 });
    await createStudentCard(student.id, card.id, { finalPrice: 2500, remainingSessions: 0 });

    const body = await (await listGET()).json();
    const found = body.activeCards.find((c: { name: string }) => c.name === "一般卡");

    expect(found.totalRevenue).toBe(5500);
    expect(found.purchasedCount).toBe(2);
    expect(found.activeHolders).toBe(1);
  });
});
