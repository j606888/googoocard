import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, createCard,
  createDanceStyles,
  type DanceStyleIds,
} from "../factories";

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { POST } from "@/app/api/liff/student-cards/route";

async function bindStudent(studentId: number, lineUserId: string) {
  await prisma.student.update({ where: { id: studentId }, data: { lineUserId } });
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

// Dance style ids for the classroom under test, keyed by the old enum name.
let S: DanceStyleIds;

describe("LIFF buy card", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
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
      // 教室第一張卡 → #A0001，計數器往前推
      expect(body.serialNumber).toBe(1);
      const classroom = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } });
      expect(classroom.nextCardSerial).toBe(2);

      const stored = await prisma.studentCard.findUnique({ where: { id: body.id } });
      expect(stored?.studentId).toBe(student.id);
    });

    it("未具資格學生購買複習卡 → 403", async () => {
      const student = await createStudent(classroomId);
      await bindStudent(student.id, "lineA");
      const card = await createCard(classroomId, {
        isPracticeCard: true,
        danceStyleId: S.BACHATA,
      });

      const res = await POST(buyRequest("lineA", { studentId: student.id, cardId: card.id }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("STUDENT_NOT_QUALIFIED");
    });

    it("具資格學生購買複習卡 → 成功", async () => {
      const student = await createStudent(classroomId, {
        qualifications: [S.BACHATA],
      });
      await bindStudent(student.id, "lineA");
      const card = await createCard(classroomId, {
        isPracticeCard: true,
        danceStyleId: S.BACHATA,
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
