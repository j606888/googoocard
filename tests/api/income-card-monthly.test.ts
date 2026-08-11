import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as listGET } from "@/app/api/income/card-monthly/route";
import { GET as detailGET } from "@/app/api/income/card-monthly/[month]/route";

// 買一張課卡 = 建一列 StudentCard,createdAt 即購買時間。
async function buyCard(
  classroomId: number,
  {
    studentName = "Student",
    cardName = "Card",
    finalPrice = 3000,
    createdAt,
    isPaid = true,
    origin,
  }: {
    studentName?: string;
    cardName?: string;
    finalPrice?: number;
    createdAt: string;
    isPaid?: boolean;
    origin?: "PURCHASE" | "CONVERSION";
  }
) {
  const student = await createStudent(classroomId, { name: studentName });
  const card = await createCard(classroomId, { name: cardName });
  return createStudentCard(student.id, card.id, {
    finalPrice,
    isPaid,
    origin,
    createdAt: new Date(createdAt),
  });
}

function callDetail(month: string) {
  const request = new Request(
    `http://test.local/api/income/card-monthly/${month}`,
    { method: "GET" }
  );
  return detailGET(request, { params: Promise.resolve({ month }) });
}

describe("GET /api/income/card-monthly", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("沒有任何課卡 → 空結果", async () => {
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ years: [], months: [] });
  });

  it("依購買月份加總 finalPrice,月份由新到舊", async () => {
    await buyCard(classroomId, { createdAt: "2026-08-05T03:00:00Z", finalPrice: 3000 });
    await buyCard(classroomId, { createdAt: "2026-08-20T03:00:00Z", finalPrice: 5000 });
    await buyCard(classroomId, { createdAt: "2026-07-10T03:00:00Z", finalPrice: 1200 });

    const body = await (await listGET()).json();
    expect(body.years).toEqual([2026]);
    expect(body.months).toEqual([
      { month: "2026-08", totalRevenue: 8000, unpaidTotal: 0, count: 2 },
      { month: "2026-07", totalRevenue: 1200, unpaidTotal: 0, count: 1 },
    ]);
  });

  it("以台北時區歸月:月底跨午夜要算進下個月", async () => {
    // 台北 2026-08-01 01:00 → 8 月
    await buyCard(classroomId, { createdAt: "2026-07-31T17:00:00Z", finalPrice: 3000 });
    // 台北 2026-07-31 23:59 → 7 月
    await buyCard(classroomId, { createdAt: "2026-07-31T15:59:00Z", finalPrice: 1000 });

    const body = await (await listGET()).json();
    expect(body.months).toEqual([
      { month: "2026-08", totalRevenue: 3000, unpaidTotal: 0, count: 1 },
      { month: "2026-07", totalRevenue: 1000, unpaidTotal: 0, count: 1 },
    ]);
  });

  it("未付款不計入營收,另計 unpaidTotal", async () => {
    await buyCard(classroomId, { createdAt: "2026-08-05T03:00:00Z", finalPrice: 3000 });
    await buyCard(classroomId, {
      createdAt: "2026-08-06T03:00:00Z",
      finalPrice: 2000,
      isPaid: false,
    });

    const body = await (await listGET()).json();
    expect(body.months).toEqual([
      { month: "2026-08", totalRevenue: 3000, unpaidTotal: 2000, count: 1 },
    ]);
  });

  it("years 涵蓋所有出現過的年份(新→舊)", async () => {
    await buyCard(classroomId, { createdAt: "2025-11-01T03:00:00Z" });
    await buyCard(classroomId, { createdAt: "2026-02-01T03:00:00Z" });

    const body = await (await listGET()).json();
    expect(body.years).toEqual([2026, 2025]);
  });

  it("跨教室隔離:只計算自己教室的課卡", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    await buyCard(otherClassroom.id, {
      createdAt: "2026-08-05T03:00:00Z",
      finalPrice: 9999,
    });
    await buyCard(classroomId, { createdAt: "2026-08-05T03:00:00Z", finalPrice: 3000 });

    const body = await (await listGET()).json();
    expect(body.months).toEqual([
      { month: "2026-08", totalRevenue: 3000, unpaidTotal: 0, count: 1 },
    ]);
  });

  it("轉換而來的卡不計入營收也不計入張數(錢在原始購買時已認列)", async () => {
    await buyCard(classroomId, { createdAt: "2026-08-05T03:00:00Z", finalPrice: 3000 });
    await buyCard(classroomId, {
      createdAt: "2026-08-06T03:00:00Z",
      finalPrice: 1500,
      origin: "CONVERSION",
    });

    const body = await (await listGET()).json();
    expect(body.months).toEqual([
      { month: "2026-08", totalRevenue: 3000, unpaidTotal: 0, count: 1 },
    ]);
  });

  it("未登入(無 classroomId) → 401", async () => {
    auth.classroomId = 0;
    const res = await listGET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/income/card-monthly/[month]", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("只回傳該月購買,含學生與課卡名稱,依購買時間新→舊", async () => {
    await buyCard(classroomId, {
      studentName: "小明",
      cardName: "10 堂卡",
      finalPrice: 5000,
      createdAt: "2026-08-03T03:00:00Z",
    });
    await buyCard(classroomId, {
      studentName: "小華",
      cardName: "6 堂卡",
      finalPrice: 3000,
      createdAt: "2026-08-20T03:00:00Z",
    });
    await buyCard(classroomId, {
      studentName: "上個月的人",
      createdAt: "2026-07-20T03:00:00Z",
    });

    const res = await callDetail("2026-08");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.month).toBe("2026-08");
    expect(body.totalRevenue).toBe(8000);
    expect(body.unpaidTotal).toBe(0);
    expect(body.purchases).toHaveLength(2);
    expect(body.purchases[0]).toMatchObject({
      studentName: "小華",
      cardName: "6 堂卡",
      finalPrice: 3000,
      isPaid: true,
      date: "2026-08-20",
    });
    expect(body.purchases[1].studentName).toBe("小明");
  });

  it("月份邊界與列表一致(台北時區)", async () => {
    await buyCard(classroomId, {
      studentName: "跨月",
      createdAt: "2026-07-31T17:00:00Z", // 台北 8/1
    });

    const julyBody = await (await callDetail("2026-07")).json();
    expect(julyBody.purchases).toHaveLength(0);

    const augBody = await (await callDetail("2026-08")).json();
    expect(augBody.purchases).toHaveLength(1);
    expect(augBody.purchases[0].date).toBe("2026-08-01");
  });

  it("未付款列在清單但不計入 totalRevenue", async () => {
    await buyCard(classroomId, {
      createdAt: "2026-08-05T03:00:00Z",
      finalPrice: 3000,
      isPaid: false,
    });

    const body = await (await callDetail("2026-08")).json();
    expect(body.totalRevenue).toBe(0);
    expect(body.unpaidTotal).toBe(3000);
    expect(body.purchases[0].isPaid).toBe(false);
  });

  it("跨教室隔離", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    await buyCard(otherClassroom.id, { createdAt: "2026-08-05T03:00:00Z" });

    const body = await (await callDetail("2026-08")).json();
    expect(body.purchases).toHaveLength(0);
  });

  it("轉換而來的卡不出現在購買明細", async () => {
    await buyCard(classroomId, {
      studentName: "買的",
      createdAt: "2026-08-05T03:00:00Z",
      finalPrice: 3000,
    });
    await buyCard(classroomId, {
      studentName: "轉換的",
      createdAt: "2026-08-06T03:00:00Z",
      finalPrice: 1500,
      origin: "CONVERSION",
    });

    const body = await (await callDetail("2026-08")).json();
    expect(body.purchases).toHaveLength(1);
    expect(body.purchases[0].studentName).toBe("買的");
    expect(body.totalRevenue).toBe(3000);
  });

  it("非法月份格式 → 400", async () => {
    for (const bad of ["2026-13", "2026", "abc", "2026-8"]) {
      const res = await callDetail(bad);
      expect(res.status).toBe(400);
    }
  });
});
