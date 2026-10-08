import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  createLesson,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/lessons/route";
import { PUT } from "@/app/api/lessons/[id]/route";

const draft = (danceType: DanceType, cardIds: number[]) => ({
  lessonName: "Test Lesson",
  teacherIds: [],
  cardIds,
  danceType,
  periods: [
    {
      startTime: "2026-06-01T10:00:00Z",
      endTime: "2026-06-01T11:00:00Z",
    },
  ],
});

describe("課程掛卡的舞種驗證", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  describe("POST /api/lessons", () => {
    it("掛上舞種不符的複習卡 → 400 並列出卡名", async () => {
      const salsaPractice = await createCard(classroomId, {
        name: "Salsa 複習卡",
        isPracticeCard: true,
        danceType: DanceType.SALSA,
      });

      const res = await POST(
        jsonRequest("POST", draft(DanceType.BACHATA, [salsaPractice.id]))
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("PRACTICE_CARD_DANCE_TYPE_MISMATCH");
      expect(body.cardNames).toEqual(["Salsa 複習卡"]);
      expect(await prisma.lesson.count()).toBe(0);
    });

    it("舞種相符的複習卡 + 一般卡 → 建立成功", async () => {
      const general = await createCard(classroomId, { name: "一般卡" });
      const bachataPractice = await createCard(classroomId, {
        name: "Bachata 複習卡",
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });

      const res = await POST(
        jsonRequest(
          "POST",
          draft(DanceType.BACHATA, [general.id, bachataPractice.id])
        )
      );

      expect(res.status).toBe(200);
      const lessonCards = await prisma.lessonCard.findMany();
      expect(lessonCards).toHaveLength(2);
    });

    it("legacy 複習卡（無舞種）任何課程都可掛", async () => {
      const legacyPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceType: null,
      });

      const res = await POST(
        jsonRequest("POST", draft(DanceType.KIZOMBA, [legacyPractice.id]))
      );

      expect(res.status).toBe(200);
    });
  });

  describe("PUT /api/lessons/[id]", () => {
    it("課程改舞種後重新驗證掛卡 → 不符回 400", async () => {
      const bachataPractice = await createCard(classroomId, {
        name: "Bachata 複習卡",
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });
      const { lesson } = await createLesson(classroomId, {
        danceType: DanceType.BACHATA,
        cardIds: [bachataPractice.id],
      });

      // 改成 Salsa 但仍掛 Bachata 複習卡
      const res = await PUT(
        jsonRequest("PUT", {
          lessonName: lesson.name,
          teacherIds: [],
          cardIds: [bachataPractice.id],
          danceType: DanceType.SALSA,
        }),
        routeParams({ id: String(lesson.id) })
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("PRACTICE_CARD_DANCE_TYPE_MISMATCH");
      // 原本的關聯不被破壞
      expect(
        await prisma.lessonCard.count({ where: { lessonId: lesson.id } })
      ).toBe(1);
    });

    it("換成相符的卡 → 更新成功", async () => {
      const bachataPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceType: DanceType.BACHATA,
      });
      const salsaPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceType: DanceType.SALSA,
      });
      const { lesson } = await createLesson(classroomId, {
        danceType: DanceType.BACHATA,
        cardIds: [bachataPractice.id],
      });

      const res = await PUT(
        jsonRequest("PUT", {
          lessonName: lesson.name,
          teacherIds: [],
          cardIds: [salsaPractice.id],
          danceType: DanceType.SALSA,
        }),
        routeParams({ id: String(lesson.id) })
      );

      expect(res.status).toBe(200);
      const lessonCards = await prisma.lessonCard.findMany({
        where: { lessonId: lesson.id },
      });
      expect(lessonCards.map((lc) => lc.cardId)).toEqual([salsaPractice.id]);
    });
  });
});

describe("課程階級", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("未帶 level → 預設初階 (1)", async () => {
    const card = await createCard(classroomId);
    const res = await POST(jsonRequest("POST", draft(DanceType.HUSTLE, [card.id])));
    expect(res.status).toBe(200);
    const lesson = await prisma.lesson.findFirstOrThrow();
    expect(lesson.level).toBe(1);
  });

  it("帶 level 建立與更新", async () => {
    const card = await createCard(classroomId);
    await POST(
      jsonRequest("POST", { ...draft(DanceType.HUSTLE, [card.id]), level: 2 })
    );
    const lesson = await prisma.lesson.findFirstOrThrow();
    expect(lesson.level).toBe(2);

    const res = await PUT(
      jsonRequest("PUT", { ...draft(DanceType.HUSTLE, [card.id]), level: 3 }),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(200);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).level).toBe(3);
  });

  it("無效 level → 400", async () => {
    const card = await createCard(classroomId);
    const res = await POST(
      jsonRequest("POST", { ...draft(DanceType.HUSTLE, [card.id]), level: 4 })
    );
    expect(res.status).toBe(400);
    expect(await prisma.lesson.count()).toBe(0);
  });
});
