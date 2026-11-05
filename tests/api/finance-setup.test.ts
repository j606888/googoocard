import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLocation,
  createLesson,
  createTeacher,
  createVenue,
  createVenuePack,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as SETUP_GET } from "@/app/api/finance/setup/route";
import { POST as LEGACY_CONFIRM } from "@/app/api/finance/legacy-prepaid/confirm/route";
import { POST as CONFIRM_OPENING } from "@/app/api/finance/locations/[id]/confirm-opening/route";
import { GET as LOCATIONS_GET } from "@/app/api/finance/locations/route";
import { GET as TEACHERS_GET } from "@/app/api/finance/teachers/route";
import { setupChecklist } from "@/service/finance/setup";

const byKey = async (classroomId: number) =>
  Object.fromEntries((await setupChecklist(classroomId)).map((i) => [i.key, i]));

describe("finance setup checklist", () => {
  let classroomId: number;
  let ownerId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableFinanceFor(classroomId, { launch: new Date("2026-11-02T16:00:00Z"), legacyCustodianUserId: ownerId });
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
  });

  it("fresh classroom: items in spec order; nothing-to-configure items are vacuously done", async () => {
    const items = await setupChecklist(classroomId);
    expect(items.map((i) => i.key)).toEqual([
      "branches",
      "lessonBranches",
      "teachers",
      "venues",
      "rules",
      "funds",
      "receivers",
      "legacyPrepaid",
    ]);
    const done = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(done).toEqual({
      branches: false,
      lessonBranches: true,
      teachers: true,
      venues: true,
      rules: true,
      funds: false,
      receivers: true,
      legacyPrepaid: false,
    });
    const res = await SETUP_GET(jsonRequest("GET"), routeParams({}));
    expect((await res.json()).complete).toBe(false);
  });

  it("disabled classroom -> 404", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeEnabledAt: null } });
    const res = await SETUP_GET(jsonRequest("GET"), routeParams({}));
    expect(res.status).toBe(404);
  });

  it("each item flips as data is filled in", async () => {
    const loc = await createLocation(classroomId, { name: "A" });
    expect((await byKey(classroomId)).branches.done).toBe(false);
    await prisma.location.update({ where: { id: loc.id }, data: { keeperUserId: ownerId } });
    expect((await byKey(classroomId)).branches.done).toBe(true);

    const { lesson } = await createLesson(classroomId);
    expect((await byKey(classroomId)).lessonBranches.done).toBe(false);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { locationId: loc.id } });
    expect((await byKey(classroomId)).lessonBranches.done).toBe(true);

    const teacher = await createTeacher(classroomId);
    await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: teacher.id } });
    expect((await byKey(classroomId)).teachers.done).toBe(false);
    await prisma.teacher.update({ where: { id: teacher.id }, data: { payerUserId: ownerId } });
    expect((await byKey(classroomId)).teachers.done).toBe(true);

    // linked to a finance member also counts
    await prisma.teacher.update({ where: { id: teacher.id }, data: { payerUserId: null, userId: ownerId } });
    expect((await byKey(classroomId)).teachers.done).toBe(true);
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: false, canSettle: false } });
    expect((await byKey(classroomId)).teachers.done).toBe(false);
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });

    const venue = await createVenue(classroomId, { name: "V" });
    expect((await byKey(classroomId)).venues.done).toBe(true); // no venuePack line yet
    expect((await byKey(classroomId)).rules.done).toBe(false);
    await prisma.lessonSplitRule.create({
      data: {
        lessonId: lesson.id,
        updatedById: ownerId,
        rule: {
          lines: [{ kind: "venuePack", venueId: venue.id }],
          rest: { type: "fund", locationId: loc.id },
          fundLocationId: loc.id,
        },
      },
    });
    const k = await byKey(classroomId);
    expect(k.rules.done).toBe(true);
    expect(k.venues.done).toBe(false); // venuePack line but no pack yet
    await createVenuePack(classroomId, venue.id, { sessions: 10, price: 1000, paidByUserId: ownerId });
    expect((await byKey(classroomId)).venues.done).toBe(true);

    expect((await byKey(classroomId)).funds.done).toBe(false);
    const res = await CONFIRM_OPENING(
      jsonRequest("POST", { fundOpening: 500 }),
      routeParams({ id: String(loc.id) }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.location.findUniqueOrThrow({ where: { id: loc.id } });
    expect(after.fundOpening).toBe(500);
    expect(after.fundOpeningConfirmedAt).not.toBeNull();
    expect((await byKey(classroomId)).funds.done).toBe(true);

    expect((await byKey(classroomId)).legacyPrepaid.done).toBe(false);
    expect((await LEGACY_CONFIRM(jsonRequest("POST"), routeParams({}))).status).toBe(200);
    const final = await setupChecklist(classroomId);
    expect(final.every((i) => i.done)).toBe(true);
  });

  it("legacyPrepaid detail: 3 legacy cards 2000/6 with 1,2,3 left -> 6 sessions, $2,000", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const old = new Date("2026-06-01T00:00:00Z");
    for (const left of [1, 2, 3]) {
      await createStudentCard(student.id, card.id, {
        finalPrice: 2000,
        totalSessions: 6,
        remainingSessions: left,
        createdAt: old,
      });
    }
    // excluded: has a receiver, unpaid, empty, closed, created after launch
    await prisma.studentCard.updateMany({ data: { isPaid: true } });
    const withReceiver = await createStudentCard(student.id, card.id, { createdAt: old });
    await prisma.studentCard.update({ where: { id: withReceiver.id }, data: { paidByUserId: ownerId } });
    await createStudentCard(student.id, card.id, { createdAt: old, isPaid: false });
    await createStudentCard(student.id, card.id, { createdAt: old, remainingSessions: 0 });
    const closed = await createStudentCard(student.id, card.id, { createdAt: old });
    await prisma.studentCard.update({ where: { id: closed.id }, data: { expiredAt: new Date() } });
    await createStudentCard(student.id, card.id, { createdAt: new Date("2026-12-01T00:00:00Z") });

    const { legacyPrepaid } = await byKey(classroomId);
    expect(legacyPrepaid.detail).toBe(`舊卡 3 張、6 格、約 $2,000 由 Owner 保管`);
  });

  it("confirm routes need a finance member; confirm-opening is classroom-scoped", async () => {
    const member = await createMember(classroomId);
    const loc = await createLocation(classroomId);
    auth.userId = member.id;
    expect((await LEGACY_CONFIRM(jsonRequest("POST"), routeParams({}))).status).toBe(403);
    expect(
      (await CONFIRM_OPENING(jsonRequest("POST", { fundOpening: 1 }), routeParams({ id: String(loc.id) }))).status,
    ).toBe(403);
    auth.userId = ownerId;
    expect(
      (await CONFIRM_OPENING(jsonRequest("POST", { fundOpening: 1 }), routeParams({ id: "99999" }))).status,
    ).toBe(404);
  });

  it("finance location / teacher lists expose only setup fields", async () => {
    await createLocation(classroomId, { name: "A" });
    await createTeacher(classroomId, { name: "T" });
    const l = await (await LOCATIONS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(Object.keys(l.locations[0]).sort()).toEqual(
      ["expiryTo", "expiryUserId", "fundOpening", "fundOpeningConfirmedAt", "id", "keeperUserId", "name"].sort(),
    );
    const t = await (await TEACHERS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(Object.keys(t.teachers[0]).sort()).toEqual(["id", "name", "payerUserId", "userId"]);
  });

  it("venuePack in a period override also needs a pack", async () => {
    const loc = await createLocation(classroomId);
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true, locationId: loc.id });
    const venue = await createVenue(classroomId);
    await prisma.periodSplitOverride.create({
      data: {
        lessonPeriodId: period!.id,
        updatedById: ownerId,
        rule: { lines: [{ kind: "venuePack", venueId: venue.id }], rest: { type: "fund", locationId: loc.id }, fundLocationId: loc.id },
      },
    });
    expect(lesson.id).toBeGreaterThan(0);
    expect((await byKey(classroomId)).venues.done).toBe(false);
    await createVenuePack(classroomId, venue.id, { sessions: 5, price: 500, paidByUserId: ownerId });
    expect((await byKey(classroomId)).venues.done).toBe(true);
  });

  it("another classroom's data does not affect checklist or lists", async () => {
    const other = await createClassroom({ name: "Other", email: "o2@test.local" });
    const oLoc = await createLocation(other.id, { name: "Other loc" });
    await createTeacher(other.id, { name: "Other teacher" });
    const oVenue = await createVenue(other.id, { name: "OV" });
    await createLesson(other.id, { locationId: null });
    await createVenuePack(other.id, oVenue.id, { sessions: 1, price: 1, paidByUserId: other.ownerId });
    await prisma.location.update({ where: { id: oLoc.id }, data: { keeperUserId: other.ownerId, fundOpeningConfirmedAt: new Date() } });

    const k = await byKey(classroomId);
    expect(k.branches.done).toBe(false);
    expect(k.funds.done).toBe(false);
    expect(k.lessonBranches.done).toBe(true);
    const l = await (await LOCATIONS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(l.locations).toHaveLength(0);
    const t = await (await TEACHERS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(t.teachers).toHaveLength(0);
    // cannot confirm another classroom's branch
    const res = await CONFIRM_OPENING(jsonRequest("POST", { fundOpening: 1 }), routeParams({ id: String(oLoc.id) }));
    expect(res.status).toBe(404);
  });

  it("legacy confirm needs a custodian; confirm-opening rejects archived branches", async () => {
    const loc = await createLocation(classroomId, { archivedAt: new Date() });
    const res = await CONFIRM_OPENING(jsonRequest("POST", { fundOpening: 1 }), routeParams({ id: String(loc.id) }));
    expect(res.status).toBe(404);
    await prisma.classroom.update({ where: { id: classroomId }, data: { legacyCustodianUserId: null } });
    const bad = await LEGACY_CONFIRM(jsonRequest("POST"), routeParams({}));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("LEGACY_CUSTODIAN_REQUIRED");
  });
});
