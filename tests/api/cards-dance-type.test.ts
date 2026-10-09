import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  createDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/cards/route";
import { PATCH } from "@/app/api/cards/[id]/route";

describe("Card danceStyleId as a category label for general cards", () => {
  let classroomId: number;
  let zouk: number;
  let hustle: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    zouk = (await createDanceStyle(classroomId, { name: "Zouk", color: "slate" })).id;
    hustle = (await createDanceStyle(classroomId, { name: "Hustle", color: "stone" })).id;
  });

  it("POST general card with a dance style persists it and returns the style", async () => {
    const res = await POST(
      jsonRequest("POST", {
        name: "Zouk 8堂",
        price: 3200,
        sessions: 8,
        isPracticeCard: false,
        danceStyleId: zouk,
      }),
      routeParams({})
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.danceStyle).toEqual({ id: zouk, name: "Zouk", color: "slate", hasLevels: false });
    const card = await prisma.card.findFirst({ where: { name: "Zouk 8堂" } });
    expect(card?.isPracticeCard).toBe(false);
    expect(card?.danceStyleId).toBe(zouk);
  });

  it("POST general card without a dance style stays null", async () => {
    await POST(
      jsonRequest("POST", {
        name: "通用 10堂",
        price: 5000,
        sessions: 10,
        isPracticeCard: false,
        danceStyleId: null,
      }),
      routeParams({})
    );
    const card = await prisma.card.findFirst({ where: { name: "通用 10堂" } });
    expect(card?.danceStyleId).toBeNull();
  });

  it("POST practice card without a dance style is still rejected", async () => {
    const res = await POST(
      jsonRequest("POST", {
        name: "複習卡",
        price: 1000,
        sessions: 8,
        isPracticeCard: true,
        danceStyleId: null,
      }),
      routeParams({})
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("PRACTICE_CARD_REQUIRES_DANCE_TYPE");
    expect(await prisma.card.count()).toBe(0);
  });

  it("POST with another classroom's dance style is rejected with 400", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createDanceStyle(other.id, { name: "Locking" });

    const res = await POST(
      jsonRequest("POST", {
        name: "複習卡",
        price: 1000,
        sessions: 8,
        isPracticeCard: true,
        danceStyleId: foreign.id,
      }),
      routeParams({})
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("DANCE_STYLE_NOT_FOUND");
    expect(await prisma.card.count()).toBe(0);
  });

  it("PATCH can add a dance style to an existing general card", async () => {
    const card = await createCard(classroomId, { name: "Hustle 單堂" });

    const res = await PATCH(
      jsonRequest("PATCH", {
        name: "Hustle 單堂",
        price: 450,
        sessions: 1,
        isPracticeCard: false,
        danceStyleId: hustle,
      }),
      routeParams({ id: String(card.id) })
    );

    expect(res.status).toBe(200);
    const updated = await prisma.card.findUnique({ where: { id: card.id } });
    expect(updated?.isPracticeCard).toBe(false);
    expect(updated?.danceStyleId).toBe(hustle);
  });

  it("PATCH with another classroom's dance style is rejected with 400", async () => {
    const card = await createCard(classroomId, { name: "Hustle 單堂" });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createDanceStyle(other.id, { name: "Locking" });

    const res = await PATCH(
      jsonRequest("PATCH", {
        name: "Hustle 單堂",
        price: 450,
        sessions: 1,
        isPracticeCard: false,
        danceStyleId: foreign.id,
      }),
      routeParams({ id: String(card.id) })
    );

    expect(res.status).toBe(400);
    const unchanged = await prisma.card.findUnique({ where: { id: card.id } });
    expect(unchanged?.danceStyleId).toBeNull();
  });
});
