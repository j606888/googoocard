import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLocation,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/locations/route";
import { PATCH } from "@/app/api/locations/[id]/route";
import { PUT as REORDER } from "@/app/api/locations/order/route";
import { POST as ASSIGN } from "@/app/api/locations/assign/route";
import { PATCH as SETTINGS } from "@/app/api/locations/settings/route";

// Taipei 20:00 on a Sunday / Wednesday (UTC+8).
const SUNDAY = new Date("2026-10-25T12:00:00Z");
const WEDNESDAY = new Date("2026-10-28T12:00:00Z");

async function lessonOn(classroomId: number, startTime: Date, locationId: number | null = null) {
  const { lesson } = await createLesson(classroomId, { locationId });
  await prisma.lessonPeriod.create({
    data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000) },
  });
  return lesson;
}

describe("/api/locations", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("GET lists this classroom's locations in sortOrder, whitelisted, with the LINE toggle", async () => {
    await createLocation(classroomId, { name: "高雄", sortOrder: 1, address: "高雄市" });
    await createLocation(classroomId, { name: "台南", sortOrder: 0, archivedAt: new Date("2026-01-01") });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    await createLocation(other.id, { name: "台北" });

    const res = await GET(jsonRequest("GET"), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lineListed).toBe(false);
    expect(body.locations.map((l: { name: string }) => l.name)).toEqual(["台南", "高雄"]);
    expect(Object.keys(body.locations[0]).sort()).toEqual(
      ["address", "archivedAt", "id", "name", "sortOrder"].sort()
    );
  });

  it("POST appends; duplicate name is 409 but another classroom may reuse it", async () => {
    await createLocation(classroomId, { name: "台南", sortOrder: 3 });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    await createLocation(other.id, { name: "高雄" });

    const created = await POST(jsonRequest("POST", { name: " 高雄 ", address: "  " }), routeParams({}));
    expect(created.status).toBe(200);
    const body = await created.json();
    expect(body).toMatchObject({ name: "高雄", address: null, sortOrder: 4 });

    const dup = await POST(jsonRequest("POST", { name: "台南" }), routeParams({}));
    expect(dup.status).toBe(409);
  });

  it("PATCH archives keeping the first date, and 404s for another classroom", async () => {
    const first = new Date("2026-01-01");
    const loc = await createLocation(classroomId, { archivedAt: first });
    const res = await PATCH(jsonRequest("PATCH", { archived: true, address: "台南市" }), routeParams({ id: String(loc.id) }));
    const body = await res.json();
    expect(new Date(body.archivedAt).getTime()).toBe(first.getTime());
    expect(body.address).toBe("台南市");

    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createLocation(other.id);
    const res404 = await PATCH(jsonRequest("PATCH", { name: "x" }), routeParams({ id: String(foreign.id) }));
    expect(res404.status).toBe(404);
  });

  it("PUT order rewrites sortOrder; a foreign id is refused", async () => {
    const a = await createLocation(classroomId, { name: "台南" });
    const b = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });
    const res = await REORDER(jsonRequest("PUT", { ids: [b.id, a.id] }), routeParams({}));
    expect((await res.json()).map((l: { name: string }) => l.name)).toEqual(["高雄", "台南"]);

    const bad = await REORDER(jsonRequest("PUT", { ids: [b.id, a.id, 999] }), routeParams({}));
    expect(bad.status).toBe(400);
  });

  it("assign tags only the picked lessons that are unassigned and in this classroom", async () => {
    const tainan = await createLocation(classroomId, { name: "台南" });
    const kaohsiung = await createLocation(classroomId, { name: "高雄" });
    // Same weekday, different branches — the reason it's a pick list, not a weekday rule.
    const tuesdayTainan = await lessonOn(classroomId, WEDNESDAY);
    const tuesdayKaohsiung = await lessonOn(classroomId, WEDNESDAY);
    const alreadySet = await lessonOn(classroomId, SUNDAY, kaohsiung.id);
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreignLesson = await lessonOn(other.id, SUNDAY);

    const res = await ASSIGN(
      jsonRequest("POST", {
        locationId: tainan.id,
        lessonIds: [tuesdayTainan.id, alreadySet.id, foreignLesson.id],
      }),
      routeParams({})
    );
    expect(await res.json()).toEqual({ updated: 1 });

    const byId = async (id: number) => (await prisma.lesson.findUniqueOrThrow({ where: { id } })).locationId;
    expect(await byId(tuesdayTainan.id)).toBe(tainan.id);
    expect(await byId(tuesdayKaohsiung.id)).toBeNull();
    expect(await byId(alreadySet.id)).toBe(kaohsiung.id);
    expect(await byId(foreignLesson.id)).toBeNull();
  });

  it("assign refuses another classroom's location", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createLocation(other.id);
    const res = await ASSIGN(jsonRequest("POST", { locationId: foreign.id, lessonIds: [1] }), routeParams({}));
    expect(res.status).toBe(400);
  });

  it("settings toggles lineListed for this classroom only", async () => {
    const res = await SETTINGS(jsonRequest("PATCH", { lineListed: true }), routeParams({}));
    expect(await res.json()).toEqual({ lineListed: true });
    expect((await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } })).lineListed).toBe(true);
  });

  it("401 without a classroom", async () => {
    auth.classroomId = undefined;
    const res = await GET(jsonRequest("GET"), routeParams({}));
    expect(res.status).toBe(401);
  });
});
