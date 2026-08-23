import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/cards/route";
import { PATCH } from "@/app/api/cards/[id]/route";

describe("Card danceType as a category label for general cards", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("POST general card with a danceType persists it", async () => {
    const res = await POST(
      jsonRequest("POST", {
        name: "Zouk 8堂",
        price: 3200,
        sessions: 8,
        isPracticeCard: false,
        danceType: DanceType.ZOUK,
      }),
      routeParams({})
    );

    expect(res.status).toBe(200);
    const card = await prisma.card.findFirst({ where: { name: "Zouk 8堂" } });
    expect(card?.isPracticeCard).toBe(false);
    expect(card?.danceType).toBe(DanceType.ZOUK);
  });

  it("POST general card without a danceType stays null", async () => {
    await POST(
      jsonRequest("POST", {
        name: "通用 10堂",
        price: 5000,
        sessions: 10,
        isPracticeCard: false,
        danceType: null,
      }),
      routeParams({})
    );
    const card = await prisma.card.findFirst({ where: { name: "通用 10堂" } });
    expect(card?.danceType).toBeNull();
  });

  it("POST practice card without a danceType is still rejected", async () => {
    const res = await POST(
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
    expect(await prisma.card.count()).toBe(0);
  });

  it("PATCH can add a danceType to an existing general card", async () => {
    const card = await createCard(classroomId, { name: "Hustle 單堂" });

    const res = await PATCH(
      jsonRequest("PATCH", {
        name: "Hustle 單堂",
        price: 450,
        sessions: 1,
        isPracticeCard: false,
        danceType: DanceType.HUSTLE,
      }),
      routeParams({ id: String(card.id) })
    );

    expect(res.status).toBe(200);
    const updated = await prisma.card.findUnique({ where: { id: card.id } });
    expect(updated?.isPracticeCard).toBe(false);
    expect(updated?.danceType).toBe(DanceType.HUSTLE);
  });
});
