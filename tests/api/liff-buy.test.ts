import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, createCard } from "../factories";

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { GET } from "@/app/api/liff/cards/route";
import { POST } from "@/app/api/liff/student-cards/route";

async function bindStudent(studentId: number, lineUserId: string) {
  await prisma.student.update({ where: { id: studentId }, data: { lineUserId } });
}

function cardsRequest(token: string | null, studentId?: number) {
  const url = studentId
    ? `http://test.local/api/liff/cards?studentId=${studentId}`
    : "http://test.local/api/liff/cards";
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function buyRequest(token: string | null, body: unknown) {
  return new Request("http://test.local/api/liff/student-cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("LIFF buy card", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  describe("GET /api/liff/cards", () => {
    it("無效 token → 401", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");
      const res = await GET(cardsRequest("bad", student.id));
      expect(res.status).toBe(401);
    });

    it("缺少 studentId → 400", async () => {
      const res = await GET(cardsRequest("lineA"));
      expect(res.status).toBe(400);
    });

    it("帶別人的 studentId → 403（防越權）", async () => {
      const mine = await createStudent(classroomId, { name: "Mine" });
      const other = await createStudent(classroomId, { name: "Other" });
      await bindStudent(mine.id, "lineMe");
      await bindStudent(other.id, "lineOther");
      const res = await GET(cardsRequest("lineMe", other.id));
      expect(res.status).toBe(403);
    });

    it("回傳該教室的 active 卡片", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");
      await createCard(classroomId, { name: "一般卡" });
      await createCard(classroomId, {
        name: "Bachata 複習卡",
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });

      const res = await GET(cardsRequest("lineA", student.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body.map((c: { name: string }) => c.name).sort()).toEqual(
        ["Bachata 複習卡", "一般卡"].sort(),
      );
    });
  });

  describe("POST /api/liff/student-cards", () => {
    it("購買一般卡 → 建立未付款、STUDENT 來源的課卡", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");
      const card = await createCard(classroomId, { price: 3000, sessions: 6 });

      const res = await POST(buyRequest("lineA", { studentId: student.id, cardId: card.id }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPaid).toBe(false);
      expect(body.paidAt).toBeNull();
      expect(body.purchaseSource).toBe("STUDENT");
      expect(body.finalPrice).toBe(3000);
      expect(body.totalSessions).toBe(6);
      expect(body.remainingSessions).toBe(6);

      const stored = await prisma.studentCard.findUnique({ where: { id: body.id } });
      expect(stored?.studentId).toBe(student.id);
    });

    it("未具資格學生購買複習卡 → 403", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");
      const card = await createCard(classroomId, {
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });

      const res = await POST(buyRequest("lineA", { studentId: student.id, cardId: card.id }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("STUDENT_NOT_QUALIFIED");
    });

    it("具資格學生購買複習卡 → 成功", async () => {
      const student = await createStudent(classroomId, {
        qualifications: [DanceType.BACHATA],
      });
      await bindStudent(student.id, "lineA");
      const card = await createCard(classroomId, {
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });

      const res = await POST(buyRequest("lineA", { studentId: student.id, cardId: card.id }));
      expect(res.status).toBe(200);
      expect((await res.json()).purchaseSource).toBe("STUDENT");
    });

    it("帶別人的 studentId → 403（防越權）", async () => {
      const mine = await createStudent(classroomId, { name: "Mine" });
      const other = await createStudent(classroomId, { name: "Other" });
      await bindStudent(mine.id, "lineMe");
      await bindStudent(other.id, "lineOther");
      const card = await createCard(classroomId);

      const res = await POST(buyRequest("lineMe", { studentId: other.id, cardId: card.id }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("forbidden");
    });

    it("購買不存在的卡 → 404", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");

      const res = await POST(
        buyRequest("lineA", { studentId: student.id, cardId: 999999 }),
      );
      expect(res.status).toBe(404);
    });
  });
});
