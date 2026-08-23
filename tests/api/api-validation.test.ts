import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as buyCard } from "@/app/api/students/[id]/student-cards/route";
import { POST as createCardRoute } from "@/app/api/cards/route";

describe("API 輸入驗證層", () => {
  let classroomId: number;
  let studentId: number;
  let cardId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    const student = await createStudent(classroomId);
    studentId = student.id;
    const card = await createCard(classroomId, { price: 3000, sessions: 6 });
    cardId = card.id;
  });

  describe("路徑參數", () => {
    it("非數字的 id 回 400 而不是 500", async () => {
      // 以前 parseInt("abc") = NaN 直接進 Prisma，丟出未捕捉的例外變成 500。
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 6, price: 3000 }),
        routeParams({ id: "abc" })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_ID");
    });

    it("負數 id 回 400", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 6, price: 3000 }),
        routeParams({ id: "-1" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("買卡 body", () => {
    it("負數價格被擋下（會汙染營收統計）", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 6, price: -500 }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(body.fields).toHaveProperty("price");
      expect(await prisma.studentCard.count()).toBe(0);
    });

    it("零堂數被擋下", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 0, price: 3000 }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(400);
      expect(await prisma.studentCard.count()).toBe(0);
    });

    it("缺少 cardId 被擋下", async () => {
      const res = await buyCard(
        jsonRequest("POST", { sessions: 6, price: 3000 }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(400);
      expect(await prisma.studentCard.count()).toBe(0);
    });

    it("數字字串會被轉型（表單送出的是字串）", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId: String(cardId), sessions: "6", price: "2500" }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(200);
      const created = await prisma.studentCard.findFirstOrThrow();
      expect(created.totalSessions).toBe(6);
      expect(created.finalPrice).toBe(2500);
    });

    it("價格 0 是允許的（招待卡 / 全額折扣）", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 6, price: 0 }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(200);
    });

    it("壞掉的 JSON 回 400 而不是 500", async () => {
      const bad = new Request("http://test.local/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });
      const res = await buyCard(bad, routeParams({ id: String(studentId) }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_JSON");
    });
  });

  describe("契約錯誤碼保留", () => {
    it("複習卡沒填舞種仍回 PRACTICE_CARD_REQUIRES_DANCE_TYPE", async () => {
      // architecture.md 的驗證矩陣把這個字串列為 API 契約，
      // 不能因為換成 zod 就變成通用的驗證錯誤格式。
      const res = await createCardRoute(
        jsonRequest("POST", {
          name: "複習卡",
          price: 1000,
          sessions: 8,
          isPracticeCard: true,
          danceType: null,
        }),
        routeParams({})
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("PRACTICE_CARD_REQUIRES_DANCE_TYPE");
      expect(body.code).toBe("PRACTICE_CARD_REQUIRES_DANCE_TYPE");
    });
  });

  describe("買卡的 Event 與課卡同進退", () => {
    it("成功買卡會同時寫入 Event", async () => {
      const res = await buyCard(
        jsonRequest("POST", { cardId, sessions: 6, price: 3000 }),
        routeParams({ id: String(studentId) })
      );
      expect(res.status).toBe(200);

      const created = await prisma.studentCard.findFirstOrThrow();
      const event = await prisma.event.findFirstOrThrow({
        where: { resourceType: "studentCard", resourceId: created.id },
      });
      expect(event.title).toBe("購買課卡");
    });
  });
});
