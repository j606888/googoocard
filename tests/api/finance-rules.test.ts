import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createLocation,
  createTeacher,
  createVenue,
  createLesson,
  createStudent,
  createCard,
  createStudentCard,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET, PUT, DELETE } from "@/app/api/finance/lessons/[id]/rule/route";
import { GET as GET_PERIOD, PUT as PUT_PERIOD, DELETE as DELETE_PERIOD } from "@/app/api/finance/periods/[periodId]/rule/route";
import { DELETE as DELETE_LESSON } from "@/app/api/lessons/[id]/route";
import { DELETE as DELETE_LESSON_PERIOD } from "@/app/api/lessons/[id]/periods/[periodId]/route";

describe("finance split rule APIs", () => {
  let classroomId: number;
  let teacherId: number;
  let locationId: number;
  let venueId: number;
  let lessonId: number;
  let periodId: number;
  let rule: any;

  const idp = (id: number) => routeParams({ id: String(id) });
  const put = (body: unknown, id = lessonId) => PUT(jsonRequest("PUT", body), idp(id));

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId: 1 });
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isCustodian: true, canSettle: true } });
    teacherId = (await createTeacher(classroomId)).id;
    locationId = (await createLocation(classroomId)).id;
    venueId = (await createVenue(classroomId)).id;
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true });
    lessonId = lesson.id;
    periodId = period!.id;
    rule = {
      lines: [{ kind: "fixed", amount: 100, to: { type: "teacher", teacherId } }],
      rest: { type: "fund", locationId },
      fundLocationId: locationId,
    };
  });

  it("PUT validates schema", async () => {
    const bad = await put({ ...rule, lines: [{ kind: "percent", pct: 120, base: "income", to: { type: "teacher", teacherId } }] });
    expect(bad.status).toBe(400);
    expect((await put(rule)).status).toBe(200);
    const got = await (await GET(jsonRequest("GET"), idp(lessonId))).json();
    expect(got.rule).toEqual(rule);
  });

  it("rejects more than one venuePack line", async () => {
    const res = await put({ ...rule, lines: [{ kind: "venuePack", venueId }, { kind: "venuePack", venueId }] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_RULE");
  });

  it("refs must belong to classroom", async () => {
    const other = (await createClassroom({ email: "other@test.local" })).id;
    const foreign = (await createTeacher(other)).id;
    const res = await put({ ...rule, lines: [{ kind: "fixed", amount: 1, to: { type: "teacher", teacherId: foreign } }] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_RULE_REF");
    const foreignLoc = (await createLocation(other)).id;
    expect((await put({ ...rule, fundLocationId: foreignLoc })).status).toBe(400);
  });

  it("a lesson with a branch only accepts its own branch's fund; the deficit fund is pinned to it", async () => {
    const other = (await createLocation(classroomId, { name: "高雄" })).id;
    await prisma.lesson.update({ where: { id: lessonId }, data: { locationId } });
    const bad = await put({ ...rule, rest: { type: "fund", locationId: other } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("FUND_OTHER_BRANCH");
    expect((await put({ ...rule, fundLocationId: other })).status).toBe(200);
    const row = await prisma.lessonSplitRule.findUniqueOrThrow({ where: { lessonId } });
    expect((row.rule as { fundLocationId: number }).fundLocationId).toBe(locationId);
  });

  it("override for one period, and delete", async () => {
    expect((await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }))).status).toBe(200);
    expect(await prisma.periodSplitOverride.count({ where: { lessonPeriodId: periodId } })).toBe(1);
    const del = await DELETE_PERIOD(jsonRequest("DELETE"), routeParams({ periodId: String(periodId) }));
    expect(del.status).toBe(200);
    expect(await prisma.periodSplitOverride.count()).toBe(0);
  });

  it("GET period override returns the rule or null; other classroom is 404", async () => {
    const pp = routeParams({ periodId: String(periodId) });
    expect(await (await GET_PERIOD(jsonRequest("GET"), pp)).json()).toEqual({ rule: null });
    await PUT_PERIOD(jsonRequest("PUT", rule), pp);
    expect((await (await GET_PERIOD(jsonRequest("GET"), pp)).json()).rule).toEqual(rule);
    const other = (await createClassroom({ email: "other2@test.local" })).id;
    const { period } = await createLesson(other, { withPeriod: true });
    const res = await GET_PERIOD(jsonRequest("GET"), routeParams({ periodId: String(period!.id) }));
    expect(res.status).toBe(404);
  });

  it("period from another classroom is 404", async () => {
    const other = (await createClassroom({ email: "other@test.local" })).id;
    const { period } = await createLesson(other, { withPeriod: true });
    const res = await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(period!.id) }));
    expect(res.status).toBe(404);
  });

  it("delete lesson rule", async () => {
    await put(rule);
    expect((await DELETE(jsonRequest("DELETE"), idp(lessonId))).status).toBe(200);
    expect(await prisma.lessonSplitRule.count()).toBe(0);
  });

  it("deleting a period / lesson removes its split override / rule", async () => {
    await put(rule);
    await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }));
    const del = await DELETE_LESSON_PERIOD(jsonRequest("DELETE"), routeParams({ id: String(lessonId), periodId: String(periodId) }));
    expect(del.status).toBe(200);
    expect(await prisma.lessonPeriod.count({ where: { id: periodId } })).toBe(0);
    expect(await prisma.periodSplitOverride.count()).toBe(0);

    const res = await DELETE_LESSON(jsonRequest("DELETE"), idp(lessonId));
    expect(res.status).toBe(200);
    expect(await prisma.lesson.count({ where: { id: lessonId } })).toBe(0);
    expect(await prisma.lessonSplitRule.count()).toBe(0);
  });

  it("a period with an absence still can't be deleted, and keeps its override", async () => {
    await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }));
    const student = await createStudent(classroomId);
    const sc = await createStudentCard(student.id, (await createCard(classroomId)).id);
    await prisma.attendanceAbsence.create({ data: { lessonPeriodId: periodId, studentId: student.id, studentCardId: sc.id, sessionsUsed: 1 } });
    await expect(
      DELETE_LESSON_PERIOD(jsonRequest("DELETE"), routeParams({ id: String(lessonId), periodId: String(periodId) })).then((r) => r.status),
    ).resolves.not.toBe(200);
    expect(await prisma.lessonPeriod.count({ where: { id: periodId } })).toBe(1);
    expect(await prisma.periodSplitOverride.count()).toBe(1);
  });

  it("non-finance member: GET ok, writes 403", async () => {
    await put(rule);
    const member = await createMember(classroomId);
    auth.userId = member.id;
    expect((await GET(jsonRequest("GET"), idp(lessonId))).status).toBe(200);
    expect((await put(rule)).status).toBe(403);
    expect((await DELETE(jsonRequest("DELETE"), idp(lessonId))).status).toBe(403);
    expect((await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }))).status).toBe(403);
  });
});
