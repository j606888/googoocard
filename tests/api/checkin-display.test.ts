import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom } from "../factories";
import { GET } from "@/app/api/checkin-display/[key]/route";
import { GET as getManifest } from "@/app/checkin-display/[key]/manifest.webmanifest/route";

const call = (key: string) =>
  GET(new Request(`http://test.local/api/checkin-display/${key}`), { params: Promise.resolve({ key }) });

describe("iPad 門口顯示 /api/checkin-display/[key]", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom({ name: "Bailamore" })).id;
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: "kioskKey01" } });
  });

  it("valid key → classroom name and the same QR target as the poster, nothing else", async () => {
    const res = await call("kioskKey01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["classroomName", "url"]);
    expect(body.classroomName).toBe("Bailamore");
    expect(body.url).toContain("kioskKey01");
  });

  it("unknown key → 404", async () => {
    expect((await call("nope")).status).toBe(404);
  });

  it("rotated key → old one 404s", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: "newKey0002" } });
    expect((await call("kioskKey01")).status).toBe(404);
    expect((await call("newKey0002")).status).toBe(200);
  });

  it("deleted classroom → 404 even if the key were still set", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { deletedAt: new Date() } });
    expect((await call("kioskKey01")).status).toBe(404);
  });

  it("manifest keeps the home-screen icon on the kiosk page", async () => {
    const res = await getManifest(new Request("http://test.local/checkin-display/kioskKey01/manifest.webmanifest"), {
      params: Promise.resolve({ key: "kioskKey01" }),
    });
    const body = await res.json();
    expect(body.name).toBe("Bailamore 簽到");
    expect(body.start_url).toBe("/checkin-display/kioskKey01");
    expect(body.scope).toBe("/checkin-display/kioskKey01");
  });
});
