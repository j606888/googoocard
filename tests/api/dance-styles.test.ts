import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/dance-styles/route";
import { PATCH } from "@/app/api/dance-styles/[id]/route";

describe("/api/dance-styles", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("GET lists this classroom's styles in sortOrder, archived included, whitelisted", async () => {
    await createDanceStyle(classroomId, { name: "Salsa", color: "orange", sortOrder: 1 });
    await createDanceStyle(classroomId, {
      name: "Zouk",
      color: "slate",
      sortOrder: 0,
      archivedAt: new Date("2026-01-01"),
    });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    await createDanceStyle(other.id, { name: "Locking" });

    const res = await GET(jsonRequest("GET"), routeParams({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((s: { name: string }) => s.name)).toEqual(["Zouk", "Salsa"]);
    expect(Object.keys(body[0]).sort()).toEqual(
      ["archivedAt", "color", "hasLevels", "id", "name", "sortOrder"].sort()
    );
    expect(body[0].archivedAt).not.toBeNull();
  });

  it("POST creates a style at the end of the list", async () => {
    await createDanceStyle(classroomId, { name: "Bachata", sortOrder: 4 });

    const res = await POST(
      jsonRequest("POST", { name: "  Locking  ", color: "blue", hasLevels: true }),
      routeParams({})
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: "Locking", color: "blue", hasLevels: true, sortOrder: 5 });
    const row = await prisma.danceStyle.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.classroomId).toBe(classroomId);
  });

  it("POST rejects an unknown palette key and an empty name", async () => {
    for (const body of [
      { name: "Locking", color: "chartreuse" },
      { name: "   ", color: "blue" },
    ]) {
      const res = await POST(jsonRequest("POST", body), routeParams({}));
      expect(res.status).toBe(400);
    }
    expect(await prisma.danceStyle.count()).toBe(0);
  });

  it("POST with a name already used in this classroom → 409; another classroom's name is fine", async () => {
    await createDanceStyle(classroomId, { name: "Bachata" });
    const dup = await POST(jsonRequest("POST", { name: "Bachata", color: "pink" }), routeParams({}));
    expect(dup.status).toBe(409);

    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    auth.classroomId = other.id;
    const ok = await POST(jsonRequest("POST", { name: "Bachata", color: "pink" }), routeParams({}));
    expect(ok.status).toBe(200);
  });

  it("PATCH renames, recolours, toggles levels and reorders", async () => {
    const style = await createDanceStyle(classroomId, { name: "Hustle" });

    const res = await PATCH(
      jsonRequest("PATCH", { name: "Hustle 社交", color: "teal", hasLevels: true, sortOrder: 3 }),
      routeParams({ id: String(style.id) })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: "Hustle 社交",
      color: "teal",
      hasLevels: true,
      sortOrder: 3,
    });
  });

  it("PATCH archived: true/false archives and restores, keeping the first archive date", async () => {
    const style = await createDanceStyle(classroomId);
    const patch = (archived: boolean) =>
      PATCH(jsonRequest("PATCH", { archived }), routeParams({ id: String(style.id) }));

    await patch(true);
    const first = await prisma.danceStyle.findUniqueOrThrow({ where: { id: style.id } });
    expect(first.archivedAt).not.toBeNull();

    await patch(true);
    const again = await prisma.danceStyle.findUniqueOrThrow({ where: { id: style.id } });
    expect(again.archivedAt).toEqual(first.archivedAt);

    await patch(false);
    const restored = await prisma.danceStyle.findUniqueOrThrow({ where: { id: style.id } });
    expect(restored.archivedAt).toBeNull();
  });

  it("PATCH renaming onto another style's name → 409", async () => {
    await createDanceStyle(classroomId, { name: "Bachata" });
    const salsa = await createDanceStyle(classroomId, { name: "Salsa" });

    const res = await PATCH(
      jsonRequest("PATCH", { name: "Bachata" }),
      routeParams({ id: String(salsa.id) })
    );
    expect(res.status).toBe(409);
  });

  it("PATCH another classroom's style → 404, unchanged", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createDanceStyle(other.id, { name: "Locking" });

    const res = await PATCH(
      jsonRequest("PATCH", { name: "hacked", archived: true }),
      routeParams({ id: String(foreign.id) })
    );

    expect(res.status).toBe(404);
    const after = await prisma.danceStyle.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(after.name).toBe("Locking");
    expect(after.archivedAt).toBeNull();
  });

  it("without a classroom every route answers 401", async () => {
    const style = await createDanceStyle(classroomId);
    auth.classroomId = undefined;

    expect((await GET(jsonRequest("GET"), routeParams({}))).status).toBe(401);
    expect(
      (await POST(jsonRequest("POST", { name: "X", color: "blue" }), routeParams({}))).status
    ).toBe(401);
    expect(
      (await PATCH(jsonRequest("PATCH", { name: "X" }), routeParams({ id: String(style.id) })))
        .status
    ).toBe(401);
  });
});
