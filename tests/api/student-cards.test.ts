import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/students/[id]/student-cards/route";

describe("POST /api/students/[id]/student-cards (購買驗證)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("一般卡任何學生都能購買", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    const studentCards = await prisma.studentCard.findMany({
      where: { studentId: student.id },
    });
    expect(studentCards).toHaveLength(1);
    expect(studentCards[0].remainingSessions).toBe(6);
  });

  it("不符資格的學生買複習卡 → 403 STUDENT_NOT_QUALIFIED", async () => {
    const student = await createStudent(classroomId); // 無任何資格
    const card = await createCard(classroomId, {
      name: "Bachata 複習卡",
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STUDENT_NOT_QUALIFIED");
    expect(
      await prisma.studentCard.count({ where: { studentId: student.id } })
    ).toBe(0);
  });

  it("資格不符的舞種也擋（有 Salsa 資格買 Bachata 複習卡）", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.SALSA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(403);
  });

  it("符合資格的學生可以買複習卡", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(
      await prisma.studentCard.count({ where: { studentId: student.id } })
    ).toBe(1);
  });

  it("legacy 複習卡（無舞種）且無課程上下文 → 422 CARD_MISSING_DANCE_TYPE", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: null,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("CARD_MISSING_DANCE_TYPE");
  });

  it("legacy 複習卡帶 lessonId（課程內買卡）→ 用課程舞種驗證", async () => {
    const studentQualified = await createStudent(classroomId, {
      name: "qualified",
      qualifications: [DanceType.BACHATA],
    });
    const studentNot = await createStudent(classroomId, { name: "not" });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceType: null,
    });
    const { lesson } = await createLesson(classroomId, {
      danceType: DanceType.BACHATA,
      cardIds: [card.id],
    });

    const okRes = await POST(
      jsonRequest("POST", {
        cardId: card.id,
        sessions: 6,
        price: 1500,
        lessonId: lesson.id,
      }),
      routeParams({ id: String(studentQualified.id) })
    );
    expect(okRes.status).toBe(200);

    const blockedRes = await POST(
      jsonRequest("POST", {
        cardId: card.id,
        sessions: 6,
        price: 1500,
        lessonId: lesson.id,
      }),
      routeParams({ id: String(studentNot.id) })
    );
    expect(blockedRes.status).toBe(403);
  });

  it("卡片不存在 → 404", async () => {
    const student = await createStudent(classroomId);
    const res = await POST(
      jsonRequest("POST", { cardId: 9999, sessions: 6, price: 3000 }),
      routeParams({ id: String(student.id) })
    );
    expect(res.status).toBe(404);
  });
});
