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
import { PATCH as PATCH_VENUE, DELETE as DELETE_VENUE } from "@/app/api/finance/venues/[id]/route";
import { GET as GET_PACKS, POST as POST_PACK } from "@/app/api/finance/packs/route";
import { DELETE as DELETE_PACK } from "@/app/api/finance/packs/[id]/route";
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
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isCustodian: true, canSettle: true } });
    nonFinanceId = (await createMember(classroomId)).id;
  });

  it("keeper must be finance member", async () => {
    const loc = await createLocation(classroomId);
    const bad = await PATCH_LOCATION(jsonRequest("PATCH", { keeperUserId: nonFinanceId }), routeParams({ id: String(loc.id) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("NOT_FINANCE_MEMBER");

    const ok = await PATCH_LOCATION(
      jsonRequest("PATCH", { keeperUserId: 1, expiryTo: "USER", expiryUserId: 1 }),
      routeParams({ id: String(loc.id) })
    );
    expect(ok.status).toBe(200);
    const after = await prisma.location.findUniqueOrThrow({ where: { id: loc.id } });
    expect(after).toMatchObject({ keeperUserId: 1, expiryTo: "USER", expiryUserId: 1 });
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
      jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02" }),
      routeParams({})
    );
    expect(pack.status).toBe(404);

    auth.userId = nonFinanceId;
    const loc = await createLocation(classroomId);
    expect((await POST_VENUE(jsonRequest("POST", { name: "A", locationId: loc.id }), routeParams({}))).status).toBe(403);
    expect((await GET_VENUES(jsonRequest("GET"), routeParams({}))).status).toBe(200);
  });

  it("venue create/archive and landlord must be a member", async () => {
    const loc = await createLocation(classroomId);
    const bad = await POST_VENUE(jsonRequest("POST", { name: "A", locationId: loc.id, landlordUserId: 9999 }), routeParams({}));
    expect(bad.status).toBe(400);
    const res = await POST_VENUE(
      jsonRequest("POST", { name: "A", locationId: loc.id, landlordUserId: nonFinanceId, perSessionPrice: 300 }),
      routeParams({})
    );
    const v = await res.json();
    expect(v).toMatchObject({ landlordUserId: nonFinanceId, locationId: loc.id, perSessionPrice: 300 });
    // 換成買次數包
    const toPack = await PATCH_VENUE(jsonRequest("PATCH", { perSessionPrice: null }), routeParams({ id: String(v.id) }));
    expect((await toPack.json()).perSessionPrice).toBeNull();
    const arch = await PATCH_VENUE(jsonRequest("PATCH", { archived: true }), routeParams({ id: String(v.id) }));
    expect((await arch.json()).archivedAt).not.toBeNull();
  });

  it("venue needs a branch of this classroom", async () => {
    expect((await POST_VENUE(jsonRequest("POST", { name: "A" }), routeParams({}))).status).toBe(400);
    const other = await createLocation((await createClassroom({ name: "O", email: "o@test.local" })).id);
    const res = await POST_VENUE(jsonRequest("POST", { name: "A", locationId: other.id }), routeParams({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("LOCATION_NOT_FOUND");
  });

  it("duplicate venue name → 409 VENUE_NAME_TAKEN (create and rename)", async () => {
    const locationId = (await createLocation(classroomId)).id;
    expect((await POST_VENUE(jsonRequest("POST", { name: "A", locationId }), routeParams({}))).status).toBe(200);
    const dup = await POST_VENUE(jsonRequest("POST", { name: "A", locationId }), routeParams({}));
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("VENUE_NAME_TAKEN");
    const b = await (await POST_VENUE(jsonRequest("POST", { name: "B", locationId }), routeParams({}))).json();
    const rename = await PATCH_VENUE(jsonRequest("PATCH", { name: "A" }), routeParams({ id: String(b.id) }));
    expect(rename.status).toBe(409);
    expect((await rename.json()).code).toBe("VENUE_NAME_TAKEN");
  });

  /** 場地在台南，台南負責人是 user 1。 */
  async function venueWithKeeper() {
    const loc = await createLocation(classroomId);
    await prisma.location.update({ where: { id: loc.id }, data: { keeperUserId: 1 } });
    return createVenue(classroomId, { locationId: loc.id });
  }

  it("pack payer is the venue branch's keeper; no branch / no keeper → 400", async () => {
    const noBranch = await createVenue(classroomId, { name: "沒分部" });
    const r1 = await POST_PACK(jsonRequest("POST", { venueId: noBranch.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02" }), routeParams({}));
    expect(r1.status).toBe(400);
    expect((await r1.json()).code).toBe("VENUE_NO_BRANCH");

    const loc = await createLocation(classroomId, { name: "高雄" });
    const noKeeper = await createVenue(classroomId, { name: "沒負責人", locationId: loc.id });
    const r2 = await POST_PACK(jsonRequest("POST", { venueId: noKeeper.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02" }), routeParams({}));
    expect(r2.status).toBe(400);
    expect((await r2.json()).code).toBe("BRANCH_NO_KEEPER");

    const v = await venueWithKeeper();
    // 送了 paidByUserId 也不理，付款人一律是負責人
    const ok = await POST_PACK(
      jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02", paidByUserId: nonFinanceId }),
      routeParams({})
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).paidByUserId).toBe(1);
  });

  it("pack bought before launch: remaining N valued at price / total × N, dated the day before launch", async () => {
    const v = await venueWithKeeper();
    const res = await POST_PACK(
      jsonRequest("POST", { venueId: v.id, before: { totalSessions: 10, totalPrice: 3000, remaining: 4 } }),
      routeParams({})
    );
    expect(res.status).toBe(200);
    const pack = await res.json();
    expect(pack).toMatchObject({ sessions: 4, price: 1200 });
    expect(new Date(pack.purchasedAt).getTime()).toBeLessThan(LAUNCH.getTime());

    // rounds to whole dollars
    const r2 = await (
      await POST_PACK(
        jsonRequest("POST", { venueId: v.id, before: { totalSessions: 3, totalPrice: 1000, remaining: 1 } }),
        routeParams({})
      )
    ).json();
    expect(r2.price).toBe(333);

    for (const before of [
      { totalSessions: 10, totalPrice: 3000, remaining: 11 },
      { totalSessions: 10, totalPrice: 3000, remaining: 0 },
      { totalSessions: 0, totalPrice: 3000, remaining: 0 },
    ]) {
      const bad = await POST_PACK(jsonRequest("POST", { venueId: v.id, before }), routeParams({}));
      expect(bad.status).toBe(400);
    }
  });

  it("pack voids instead of delete", async () => {
    const v = await venueWithKeeper();
    const res = await POST_PACK(
      jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02" }),
      routeParams({})
    );
    expect(res.status).toBe(200);
    const pack = await res.json();

    for (const bad of [{ sessions: 0 }, { price: -1 }, { sessions: 1.5 }, { purchasedAt: "2026-02-31" }]) {
      const r = await POST_PACK(
        jsonRequest("POST", { venueId: v.id, sessions: 10, price: 1000, purchasedAt: "2026-11-02", ...bad }),
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
    expect(list.packs[0].used).toBe(0);
  });

  it("GET packs: used counts attended periods first-in-first-out", async () => {
    const v = await venueWithKeeper();
    const p1 = await createVenuePack(classroomId, v.id, { sessions: 2, price: 1000, paidByUserId: 1, purchasedAt: new Date("2026-11-01T00:00:00Z") });
    const p2 = await createVenuePack(classroomId, v.id, { sessions: 5, price: 2000, paidByUserId: 1, purchasedAt: new Date("2026-11-03T00:00:00Z") });
    const { lesson } = await createLesson(classroomId, { locationId: v.locationId });
    await prisma.lessonSplitRule.create({
      data: {
        lessonId: lesson.id,
        updatedById: 1,
        rule: { lines: [{ kind: "venuePack", venueId: v.id }], rest: { type: "fund", locationId: v.locationId! }, fundLocationId: v.locationId! },
      },
    });
    for (const day of [2, 3, 4]) {
      await prisma.lessonPeriod.create({
        data: {
          lessonId: lesson.id,
          startTime: new Date(`2026-11-0${day}T10:00:00Z`),
          endTime: new Date(`2026-11-0${day}T11:00:00Z`),
          attendanceTakenAt: new Date(),
        },
      });
    }
    const { packs } = await (await GET_PACKS(jsonRequest("GET"), routeParams({}))).json();
    const used = Object.fromEntries(packs.map((p: { id: number; used: number }) => [p.id, p.used]));
    expect(used).toEqual({ [p1.id]: 2, [p2.id]: 1 });
  });

  it("venue delete only when never used (rule or pack); otherwise 409 VENUE_IN_USE", async () => {
    const free = await createVenue(classroomId, { name: "空的" });
    expect((await DELETE_VENUE(jsonRequest("DELETE"), routeParams({ id: String(free.id) }))).status).toBe(200);
    expect(await prisma.venue.findUnique({ where: { id: free.id } })).toBeNull();

    const withPack = await venueWithKeeper();
    await createVenuePack(classroomId, withPack.id, { sessions: 1, price: 1, paidByUserId: 1 });
    const r1 = await DELETE_VENUE(jsonRequest("DELETE"), routeParams({ id: String(withPack.id) }));
    expect(r1.status).toBe(409);
    expect((await r1.json()).code).toBe("VENUE_IN_USE");

    const inRule = await createVenue(classroomId, { name: "規則裡", locationId: withPack.locationId });
    const { lesson } = await createLesson(classroomId);
    await prisma.lessonSplitRule.create({
      data: {
        lessonId: lesson.id,
        updatedById: 1,
        rule: {
          lines: [{ kind: "fixed", amount: 100, to: { type: "venue", venueId: inRule.id } }],
          rest: { type: "fund", locationId: withPack.locationId! },
          fundLocationId: withPack.locationId!,
        },
      },
    });
    expect((await DELETE_VENUE(jsonRequest("DELETE"), routeParams({ id: String(inRule.id) }))).status).toBe(409);

    const other = await createVenue((await createClassroom({ name: "O", email: "o@test.local" })).id);
    expect((await DELETE_VENUE(jsonRequest("DELETE"), routeParams({ id: String(other.id) }))).status).toBe(404);
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
