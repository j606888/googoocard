import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createLocation,
  createTeacher,
  createVenue,
  createVenuePack,
  defaultDanceStyle,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PATCH as PATCH_LOCATION } from "@/app/api/finance/locations/[id]/route";
import { GET as GET_VENUES, POST as POST_VENUE } from "@/app/api/finance/venues/route";
import { PATCH as PATCH_VENUE } from "@/app/api/finance/venues/[id]/route";
import { GET as GET_PACKS, POST as POST_PACK } from "@/app/api/finance/packs/route";
import { DELETE as DELETE_PACK } from "@/app/api/finance/packs/[id]/route";
import { PATCH as PATCH_TEACHER } from "@/app/api/finance/teachers/[id]/route";
import { POST as POST_LESSON } from "@/app/api/lessons/route";
import { PUT as PUT_LESSON } from "@/app/api/lessons/[id]/route";
import { createLesson } from "../factories";

const LAUNCH = new Date("2026-10-31T16:00:00Z");

describe("finance config APIs", () => {
  let classroomId: number;
  let nonFinanceId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: 1 });
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isFinance: true } });
    nonFinanceId = (await createMember(classroomId)).id;
  });

  it("keeper must be finance member", async () => {
    const loc = await createLocation(classroomId);
    const bad = await PATCH_LOCATION(jsonRequest("PATCH", { keeperUserId: nonFinanceId }), routeParams({ id: String(loc.id) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("NOT_FINANCE_MEMBER");

    const ok = await PATCH_LOCATION(
      jsonRequest("PATCH", { keeperUserId: 1, expiryTo: "USER", expiryUserId: 1, fundOpening: 500 }),
      routeParams({ id: String(loc.id) })
    );
    expect(ok.status).toBe(200);
    const after = await prisma.location.findUniqueOrThrow({ where: { id: loc.id } });
    expect(after).toMatchObject({ keeperUserId: 1, expiryTo: "USER", expiryUserId: 1, fundOpening: 500 });
    expect(after.fundOpeningConfirmedAt).toBeNull();
  });

  it("location in another classroom is 404", async () => {
    const other = await createClassroom({ name: "O", email: "o@test.local" });
    const loc = await createLocation(other.id);
    const res = await PATCH_LOCATION(jsonRequest("PATCH", { fundOpening: 1 }), routeParams({ id: String(loc.id) }));
    expect(res.status).toBe(404);
  });

  it("venue from another classroom is 404; writes need finance; GET is open to members", async () => {
    const other = await createClassroom({ name: "O", email: "o@test.local" });
    const v = await createVenue(other.id);
    const res = await PATCH_VENUE(jsonRequest("PATCH", { name: "x" }), routeParams({ id: String(v.id) }));
    expect(res.status).toBe(404);
    const pack = await POST_PACK(
      jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, paidByUserId: 1, purchasedAt: "2026-11-02" }),
      routeParams({})
    );
    expect(pack.status).toBe(404);

    auth.userId = nonFinanceId;
    expect((await POST_VENUE(jsonRequest("POST", { name: "A" }), routeParams({}))).status).toBe(403);
    expect((await GET_VENUES(jsonRequest("GET"), routeParams({}))).status).toBe(200);
  });

  it("venue create/archive and landlord must be a member", async () => {
    const bad = await POST_VENUE(jsonRequest("POST", { name: "A", landlordUserId: 9999 }), routeParams({}));
    expect(bad.status).toBe(400);
    const res = await POST_VENUE(jsonRequest("POST", { name: "A", landlordUserId: nonFinanceId }), routeParams({}));
    const v = await res.json();
    expect(v.landlordUserId).toBe(nonFinanceId);
    const arch = await PATCH_VENUE(jsonRequest("PATCH", { archived: true }), routeParams({ id: String(v.id) }));
    expect((await arch.json()).archivedAt).not.toBeNull();
  });

  it("pack voids instead of delete", async () => {
    const v = await createVenue(classroomId);
    const res = await POST_PACK(
      jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, paidByUserId: 1, purchasedAt: "2026-11-02" }),
      routeParams({})
    );
    expect(res.status).toBe(200);
    const pack = await res.json();

    for (const bad of [{ sessions: 0 }, { price: -1 }, { sessions: 1.5 }, { paidByUserId: nonFinanceId }]) {
      const r = await POST_PACK(
        jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, paidByUserId: 1, purchasedAt: "2026-11-02", ...bad }),
        routeParams({})
      );
      expect(r.status).toBe(400);
    }

    const del = await DELETE_PACK(jsonRequest("DELETE"), routeParams({ id: String(pack.id) }));
    expect(del.status).toBe(200);
    const row = await prisma.venuePack.findUniqueOrThrow({ where: { id: pack.id } });
    expect(row.voidedAt).not.toBeNull();
    const list = await (await GET_PACKS(jsonRequest("GET"), routeParams({}))).json();
    expect(list.packs).toHaveLength(1);
  });

  it("teacher payer must be finance member", async () => {
    const t = await createTeacher(classroomId);
    const bad = await PATCH_TEACHER(jsonRequest("PATCH", { payerUserId: nonFinanceId }), routeParams({ id: String(t.id) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("NOT_FINANCE_MEMBER");
    const ok = await PATCH_TEACHER(jsonRequest("PATCH", { payerUserId: 1 }), routeParams({ id: String(t.id) }));
    expect((await ok.json()).payerUserId).toBe(1);
  });

  async function lessonBody(extra: Record<string, unknown> = {}) {
    const style = await defaultDanceStyle(classroomId);
    return { lessonName: "L", danceStyleId: style.id, teacherIds: [], cardIds: [], periods: [], ...extra };
  }

  it("lesson create requires location when finance enabled", async () => {
    const loc = await createLocation(classroomId);
    const missing = await POST_LESSON(jsonRequest("POST", await lessonBody()));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("LOCATION_REQUIRED");
    const ok = await POST_LESSON(jsonRequest("POST", await lessonBody({ locationId: loc.id })));
    expect(ok.status).toBe(200);

    const { lesson } = await createLesson(classroomId, { locationId: loc.id });
    const clear = await PUT_LESSON(
      jsonRequest("PUT", await lessonBody({ locationId: null })),
      routeParams({ id: String(lesson.id) })
    );
    expect(clear.status).toBe(400);
    expect((await clear.json()).error).toBe("LOCATION_REQUIRED");
  });

  it("lesson create does not require location when finance disabled", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeEnabledAt: null } });
    const res = await POST_LESSON(jsonRequest("POST", await lessonBody()));
    expect(res.status).toBe(200);
  });
});
