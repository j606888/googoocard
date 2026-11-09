import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
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
import { GET as LOCATIONS_GET } from "@/app/api/finance/locations/route";
import { GET as TEACHERS_GET } from "@/app/api/finance/teachers/route";
import { POST as LINK_TEACHER } from "@/app/api/finance/teachers/[id]/link/route";
import { GET as RULED_LESSONS } from "@/app/api/finance/lessons/route";
import { GET as SETTINGS_GET, PATCH as SETTINGS_PATCH } from "@/app/api/finance/settings/route";
import { PATCH as LESSON_LOCATION } from "@/app/api/finance/lessons/[id]/location/route";
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
    await enableFinanceFor(classroomId, { launch: new Date("2026-11-02T16:00:00Z"), legacyCustodianUserId: ownerId, opened: false });
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
  });

  it("fresh classroom: items in spec order; nothing-to-configure items are vacuously done", async () => {
    const items = await setupChecklist(classroomId);
    expect(items.map((i) => i.key)).toEqual([
      "branches",
      "lessonBranches",
      "venues",
      "rules",
      "receivers",
      "cash",
      "payables",
      "opening",
    ]);
    const done = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(done).toEqual({
      branches: false,
      lessonBranches: true,
      venues: false, // no venue yet
      rules: true,
      receivers: true,
      cash: false,
      payables: false,
      opening: false,
    });
    const res = await SETUP_GET(jsonRequest("GET"), routeParams({}));
    expect((await res.json()).complete).toBe(false);
  });

  it("venues needs at least one active venue; archived ones do not count", async () => {
    const v = await createVenue(classroomId, { name: "V" });
    expect((await byKey(classroomId)).venues.done).toBe(true);
    await prisma.venue.update({ where: { id: v.id }, data: { archivedAt: new Date() } });
    expect((await byKey(classroomId)).venues.done).toBe(false);
  });

  it("venues: 勾「這間教室不用場地費」就算完成（存在教室上）", async () => {
    expect((await byKey(classroomId)).venues.done).toBe(false);
    const res = await SETTINGS_PATCH(jsonRequest("PATCH", { noVenueFee: true }), routeParams({}));
    expect(res.status).toBe(200);
    expect((await byKey(classroomId)).venues.done).toBe(true);
    expect(await (await SETTINGS_GET(jsonRequest("GET"), routeParams({}))).json()).toMatchObject({ noVenueFee: true });
    await SETTINGS_PATCH(jsonRequest("PATCH", { noVenueFee: false }), routeParams({}));
    expect((await byKey(classroomId)).venues.done).toBe(false);
  });

  it("lessonBranches lists the in-progress lessons without a branch as links", async () => {
    const loc = await createLocation(classroomId);
    const { lesson: a } = await createLesson(classroomId, { name: "Bachata 初階" });
    await createLesson(classroomId, { name: "有分部", locationId: loc.id });
    const { lesson: done } = await createLesson(classroomId, { name: "已結束" });
    await prisma.lesson.update({ where: { id: done.id }, data: { status: "finished" } });
    const { lessonBranches } = await byKey(classroomId);
    expect(lessonBranches.done).toBe(false);
    expect(lessonBranches.links).toEqual([{ label: "Bachata 初階", href: `/lessons/${a.id}` }]);
  });

  it("GET /finance/lessons lists only lessons that have a split rule", async () => {
    const loc = await createLocation(classroomId);
    const { lesson: withRule } = await createLesson(classroomId, { name: "R", locationId: loc.id });
    await createLesson(classroomId, { name: "N", locationId: loc.id });
    await prisma.lessonSplitRule.create({
      data: { lessonId: withRule.id, updatedById: ownerId, rule: { lines: [], rest: { type: "fund", locationId: loc.id }, fundLocationId: loc.id } },
    });
    const other = await createClassroom({ name: "Other", email: "o3@test.local" });
    const { lesson: otherLesson } = await createLesson(other.id);
    await prisma.lessonSplitRule.create({ data: { lessonId: otherLesson.id, updatedById: other.ownerId, rule: {} } });
    const res = await RULED_LESSONS(jsonRequest("GET"), routeParams({}));
    expect(await res.json()).toEqual({ lessons: [{ id: withRule.id, name: "R" }] });
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

    const venue = await createVenue(classroomId, { name: "V", locationId: loc.id });
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

    expect((await byKey(classroomId)).opening.done).toBe(false);
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeOpenedAt: new Date(), financeConversionDate: new Date("2026-11-01T00:00:00Z") } });
    expect((await byKey(classroomId)).opening).toMatchObject({ done: true, detail: "從 2026/11/01 開帳" });
    const final = await setupChecklist(classroomId);
    expect(final.every((i) => i.done)).toBe(true);
  });

  it("finance location / teacher lists expose only setup fields", async () => {
    await createLocation(classroomId, { name: "A" });
    await createTeacher(classroomId, { name: "T" });
    const l = await (await LOCATIONS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(Object.keys(l.locations[0]).sort()).toEqual(
      ["expiryTo", "expiryUserId", "id", "keeperUserId", "name"].sort(),
    );
    const t = await (await TEACHERS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(Object.keys(t.teachers[0]).sort()).toEqual(["id", "linkSuggestion", "name", "userId"]);
  });

  it("老師沒有付款人那一步：checklist 不再有 teachers", async () => {
    const { lesson } = await createLesson(classroomId);
    const t = await createTeacher(classroomId, { name: "Ann" });
    await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: t.id } });
    expect((await setupChecklist(classroomId)).map((i) => i.key)).not.toContain("teachers");
  });

  it("沒連帳號的老師跟某位成員同名 → 提醒「是本人嗎」，可一鍵連結", async () => {
    const sean = await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" });
    await prisma.membership.updateMany({ where: { userId: sean.id, classroomId }, data: { isCustodian: true } });
    const helper = await createMember(classroomId, { email: "nini@test.local", name: "Nini", role: "assistant" });
    await prisma.membership.updateMany({ where: { userId: helper.id, classroomId }, data: { isCustodian: true } });
    const seanT = await createTeacher(classroomId, { name: "Sean" });
    const other = await createTeacher(classroomId, { name: "搭檔" });
    const niniT = await createTeacher(classroomId, { name: "Nini" }); // 小幫手也可能是老師（票 23）

    const list = async () =>
      Object.fromEntries(
        ((await (await TEACHERS_GET(jsonRequest("GET"), routeParams({}))).json()).teachers as { id: number; linkSuggestion: unknown }[]).map(
          (t) => [t.id, t.linkSuggestion],
        ),
      );
    let s = await list();
    expect(s[seanT.id]).toEqual({ userId: sean.id, name: "Sean" });
    expect(s[other.id]).toBeNull();
    expect(s[niniT.id]).toEqual({ userId: helper.id, name: "Nini" });

    const link = (teacherId: number, userId: number) =>
      LINK_TEACHER(jsonRequest("POST", { userId }), routeParams({ id: String(teacherId) }));
    expect((await link(niniT.id, helper.id)).status).toBe(200);
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: niniT.id } })).userId).toBe(helper.id);
    expect((await link(seanT.id, sean.id)).status).toBe(200);
    expect((await prisma.teacher.findUniqueOrThrow({ where: { id: seanT.id } })).userId).toBe(sean.id);
    s = await list();
    expect(s[seanT.id]).toBeNull();
    // 已經連了別的老師 → 不能再連（409）
    expect((await link(other.id, sean.id)).status).toBe(409);

    // 不能結算的人不能連
    auth.userId = sean.id;
    const t2 = await createTeacher(classroomId, { name: "Owner" });
    expect((await link(t2.id, ownerId)).status).toBe(403);
  });

  it("venuePack in a period override also needs a pack", async () => {
    const loc = await createLocation(classroomId);
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true, locationId: loc.id });
    const venue = await createVenue(classroomId, { locationId: loc.id });
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

  it("a venue used by a rule needs a branch and a billing method (per-session price or a pack)", async () => {
    const loc = await createLocation(classroomId);
    const { lesson } = await createLesson(classroomId, { locationId: loc.id });
    const venue = await createVenue(classroomId, { name: "大樓" });
    await prisma.lessonSplitRule.create({
      data: {
        lessonId: lesson.id,
        updatedById: ownerId,
        rule: { lines: [{ kind: "venuePack", venueId: venue.id }], rest: { type: "fund", locationId: loc.id }, fundLocationId: loc.id },
      },
    });
    expect((await byKey(classroomId)).venues).toMatchObject({ done: false, detail: "還沒設好分部或收費：大樓" });
    await prisma.venue.update({ where: { id: venue.id }, data: { perSessionPrice: 300 } });
    expect((await byKey(classroomId)).venues.done).toBe(false); // 還沒選分部
    await prisma.venue.update({ where: { id: venue.id }, data: { locationId: loc.id } });
    expect((await byKey(classroomId)).venues.done).toBe(true);
  });

  it("another classroom's data does not affect checklist or lists", async () => {
    const other = await createClassroom({ name: "Other", email: "o2@test.local" });
    const oLoc = await createLocation(other.id, { name: "Other loc" });
    await createTeacher(other.id, { name: "Other teacher" });
    const oVenue = await createVenue(other.id, { name: "OV" });
    await createLesson(other.id, { locationId: null });
    await createVenuePack(other.id, oVenue.id, { sessions: 1, price: 1, paidByUserId: other.ownerId });
    await prisma.location.update({ where: { id: oLoc.id }, data: { keeperUserId: other.ownerId } });

    const k = await byKey(classroomId);
    expect(k.branches.done).toBe(false);
    expect(k.lessonBranches.done).toBe(true);
    const l = await (await LOCATIONS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(l.locations).toHaveLength(0);
    const t = await (await TEACHERS_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(t.teachers).toHaveLength(0);
  });


  it("精靈第 2 步：直接改課的分部；只收自己教室、沒封存的分部；要能結算", async () => {
    const a = await createLocation(classroomId, { name: "台南" });
    const { lesson } = await createLesson(classroomId, { name: "Bachata 初階" });
    const setup = await (await SETUP_GET(jsonRequest("GET"), routeParams({}))).json();
    expect(setup.lessons).toEqual([{ id: lesson.id, name: "Bachata 初階", locationId: null, hasRule: false }]);

    const patch = (id: number, locationId: number) =>
      LESSON_LOCATION(jsonRequest("PATCH", { locationId }), routeParams({ id: String(id) }));
    expect((await patch(lesson.id, a.id)).status).toBe(200);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).locationId).toBe(a.id);
    expect((await byKey(classroomId)).lessonBranches.done).toBe(true);

    const other = await createClassroom({ email: "other@test.local" });
    const foreignLoc = await createLocation(other.id, { name: "X" });
    expect((await patch(lesson.id, foreignLoc.id)).status).toBe(400);
    const archived = await createLocation(classroomId, { name: "舊" });
    await prisma.location.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    expect((await patch(lesson.id, archived.id)).status).toBe(400);
    const { lesson: foreignLesson } = await createLesson(other.id, { name: "別人的課" });
    expect((await patch(foreignLesson.id, a.id)).status).toBe(404);

    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { canSettle: false } });
    expect((await patch(lesson.id, a.id)).status).toBe(403);
  });
});
