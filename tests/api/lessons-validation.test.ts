import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  createLesson,
  createLocation,
  jsonRequest,
  routeParams,
  createDanceStyles,
  type DanceStyleIds,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/lessons/route";
import { PUT } from "@/app/api/lessons/[id]/route";

const draft = (danceStyleId: number, cardIds: number[]) => ({
  lessonName: "Test Lesson",
  teacherIds: [],
  cardIds,
  danceStyleId,
  periods: [
    {
      startTime: "2026-06-01T10:00:00Z",
      endTime: "2026-06-01T11:00:00Z",
    },
  ],
});

// Dance style ids for the classroom under test, keyed by the old enum name.
let S: DanceStyleIds;

describe("課程掛卡的舞種驗證", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
    auth.classroomId = classroomId;
  });

  describe("POST /api/lessons", () => {
    it("掛上舞種不符的複習卡 → 400 並列出卡名", async () => {
      const salsaPractice = await createCard(classroomId, {
        name: "Salsa 複習卡",
        isPracticeCard: true,
        danceStyleId: S.SALSA,
      });

      const res = await POST(
        jsonRequest("POST", draft(S.BACHATA, [salsaPractice.id]))
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
        danceStyleId: S.BACHATA,
      });

      const res = await POST(
        jsonRequest(
          "POST",
          draft(S.BACHATA, [general.id, bachataPractice.id])
        )
      );

      expect(res.status).toBe(200);
      const lessonCards = await prisma.lessonCard.findMany();
      expect(lessonCards).toHaveLength(2);
    });

    it("沒帶舞種 → 400 DANCE_STYLE_REQUIRED", async () => {
      const { danceStyleId: _omit, ...withoutStyle } = draft(S.BACHATA, []);
      const res = await POST(jsonRequest("POST", withoutStyle));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("DANCE_STYLE_REQUIRED");
      expect(await prisma.lesson.count()).toBe(0);
    });

    it("別間教室的舞種 → 400 DANCE_STYLE_NOT_FOUND", async () => {
      const other = await createClassroom({ name: "Other", email: "other@test.local" });
      const foreign = await createDanceStyles(other.id);

      const res = await POST(jsonRequest("POST", draft(foreign.BACHATA, [])));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("DANCE_STYLE_NOT_FOUND");
      expect(await prisma.lesson.count()).toBe(0);
    });

    it("別間教室的分部 → 400 LOCATION_NOT_FOUND；本教室的分部照寫", async () => {
      const other = await createClassroom({ name: "Other", email: "other@test.local" });
      const foreign = await createLocation(other.id);
      const res = await POST(jsonRequest("POST", { ...draft(S.SALSA, []), locationId: foreign.id }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("LOCATION_NOT_FOUND");
      expect(await prisma.lesson.count()).toBe(0);

      const own = await createLocation(classroomId);
      const ok = await POST(jsonRequest("POST", { ...draft(S.SALSA, []), locationId: own.id }));
      expect(ok.status).toBe(200);
      expect((await prisma.lesson.findFirstOrThrow()).locationId).toBe(own.id);
    });

    it("建立的課程寫入 danceStyleId", async () => {
      const res = await POST(jsonRequest("POST", draft(S.SALSA, [])));

      expect(res.status).toBe(200);
      const lesson = await prisma.lesson.findFirstOrThrow();
      expect(lesson.danceStyleId).toBe(S.SALSA);
    });

    it("legacy 複習卡（無舞種）任何課程都可掛", async () => {
      const legacyPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceStyleId: null,
      });

      const res = await POST(
        jsonRequest("POST", draft(S.KIZOMBA, [legacyPractice.id]))
      );

      expect(res.status).toBe(200);
    });
  });

  describe("PUT /api/lessons/[id]", () => {
    it("課程改舞種後重新驗證掛卡 → 不符回 400", async () => {
      const bachataPractice = await createCard(classroomId, {
        name: "Bachata 複習卡",
        isPracticeCard: true,
        danceStyleId: S.BACHATA,
      });
      const { lesson } = await createLesson(classroomId, {
        danceStyleId: S.BACHATA,
        cardIds: [bachataPractice.id],
      });

      // 改成 Salsa 但仍掛 Bachata 複習卡
      const res = await PUT(
        jsonRequest("PUT", {
          lessonName: lesson.name,
          teacherIds: [],
          cardIds: [bachataPractice.id],
          danceStyleId: S.SALSA,
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

    it("改成別間教室的舞種 → 400，課程不變", async () => {
      const { lesson } = await createLesson(classroomId, { danceStyleId: S.BACHATA });
      const other = await createClassroom({ name: "Other", email: "other@test.local" });
      const foreign = await createDanceStyles(other.id);

      const res = await PUT(
        jsonRequest("PUT", {
          lessonName: lesson.name,
          teacherIds: [],
          cardIds: [],
          danceStyleId: foreign.SALSA,
        }),
        routeParams({ id: String(lesson.id) })
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("DANCE_STYLE_NOT_FOUND");
      const unchanged = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
      expect(unchanged.danceStyleId).toBe(S.BACHATA);
    });

    it("換成相符的卡 → 更新成功", async () => {
      const bachataPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceStyleId: S.BACHATA,
      });
      const salsaPractice = await createCard(classroomId, {
        isPracticeCard: true,
        danceStyleId: S.SALSA,
      });
      const { lesson } = await createLesson(classroomId, {
        danceStyleId: S.BACHATA,
        cardIds: [bachataPractice.id],
      });

      const res = await PUT(
        jsonRequest("PUT", {
          lessonName: lesson.name,
          teacherIds: [],
          cardIds: [salsaPractice.id],
          danceStyleId: S.SALSA,
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
    S = await createDanceStyles(classroomId);
    auth.classroomId = classroomId;
  });

  it("未帶 level → 預設初階 (1)", async () => {
    const card = await createCard(classroomId);
    const res = await POST(jsonRequest("POST", draft(S.HUSTLE, [card.id])));
    expect(res.status).toBe(200);
    const lesson = await prisma.lesson.findFirstOrThrow();
    expect(lesson.level).toBe(1);
  });

  it("帶 level 建立與更新", async () => {
    const card = await createCard(classroomId);
    await POST(
      jsonRequest("POST", { ...draft(S.HUSTLE, [card.id]), level: 2 })
    );
    const lesson = await prisma.lesson.findFirstOrThrow();
    expect(lesson.level).toBe(2);

    const res = await PUT(
      jsonRequest("PUT", { ...draft(S.HUSTLE, [card.id]), level: 3 }),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(200);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).level).toBe(3);
  });

  it("無效 level → 400", async () => {
    const card = await createCard(classroomId);
    const res = await POST(
      jsonRequest("POST", { ...draft(S.HUSTLE, [card.id]), level: 4 })
    );
    expect(res.status).toBe(400);
    expect(await prisma.lesson.count()).toBe(0);
  });
});
