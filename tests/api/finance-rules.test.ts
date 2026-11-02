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
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET, PUT, DELETE } from "@/app/api/finance/lessons/[id]/rule/route";
import { POST as COPY } from "@/app/api/finance/lessons/[id]/rule/copy/route";
import { PUT as PUT_PERIOD, DELETE as DELETE_PERIOD } from "@/app/api/finance/periods/[periodId]/rule/route";

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
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isFinance: true } });
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

  it("copy rule from another lesson", async () => {
    await put(rule);
    const { lesson: other } = await createLesson(classroomId);
    const res = await COPY(jsonRequest("POST", { fromLessonId: lessonId }), idp(other.id));
    expect(res.status).toBe(200);
    const row = await prisma.lessonSplitRule.findUniqueOrThrow({ where: { lessonId: other.id } });
    expect(row.rule).toEqual(rule);
    const { lesson: empty } = await createLesson(classroomId);
    const none = await COPY(jsonRequest("POST", { fromLessonId: empty.id }), idp(other.id));
    expect(none.status).toBe(404);
  });

  it("override for one period, and delete", async () => {
    expect((await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }))).status).toBe(200);
    expect(await prisma.periodSplitOverride.count({ where: { lessonPeriodId: periodId } })).toBe(1);
    const del = await DELETE_PERIOD(jsonRequest("DELETE"), routeParams({ periodId: String(periodId) }));
    expect(del.status).toBe(200);
    expect(await prisma.periodSplitOverride.count()).toBe(0);
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

  it("non-finance member: GET ok, writes 403", async () => {
    await put(rule);
    const member = await createMember(classroomId);
    auth.userId = member.id;
    expect((await GET(jsonRequest("GET"), idp(lessonId))).status).toBe(200);
    expect((await put(rule)).status).toBe(403);
    expect((await DELETE(jsonRequest("DELETE"), idp(lessonId))).status).toBe(403);
    expect((await PUT_PERIOD(jsonRequest("PUT", rule), routeParams({ periodId: String(periodId) }))).status).toBe(403);
    expect((await COPY(jsonRequest("POST", { fromLessonId: lessonId }), idp(lessonId))).status).toBe(403);
  });
});
