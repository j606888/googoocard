import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, jsonRequest, routeParams } from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { DELETE } from "@/app/api/students/[id]/line-binding/route";
import { GET as EVENTS } from "@/app/api/students/[id]/events/route";
import { syncLineProfile } from "@/service/lineBinding";

const LINE_PIC = "https://profile.line-scdn.net/old";
const PRESET = "/images/avatars/not-sure.png";

const unbind = (id: number) => DELETE(jsonRequest("DELETE"), routeParams({ id: String(id) }));

describe("DELETE /api/students/[id]/line-binding — 解除 LINE 綁定", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
  });

  it("清掉 LINE、LINE 名稱與大頭照、邀請時間，寫一筆動態", async () => {
    const student = await createStudent(classroomId, { name: "綁錯" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "Uwrong", lineDisplayName: "別人", avatarUrl: LINE_PIC, lineInviteSentAt: new Date() },
    });

    const res = await unbind(student.id);
    expect(res.status).toBe(200);

    const after = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(after).toMatchObject({ lineUserId: null, lineDisplayName: null, avatarUrl: PRESET, lineInviteSentAt: null });

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const events = await (await EVENTS(jsonRequest("GET"), routeParams({ id: String(student.id) }))).json();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "解除 LINE 綁定",
      description: `${owner.name} 在後台解除 · LINE 名稱「別人」`,
    });
  });

  it("老師上傳的大頭照解除後保留", async () => {
    const uploaded = "https://res.cloudinary.com/demo/image/upload/a.jpg";
    const student = await createStudent(classroomId);
    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "U1", avatarUrl: uploaded } });
    await unbind(student.id);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).avatarUrl).toBe(uploaded);
  });

  it("沒綁定 → 400；別間教室 → 404", async () => {
    const unbound = await createStudent(classroomId);
    const res = await unbind(unbound.id);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NOT_BOUND");

    const other = await prisma.classroom.create({ data: { ownerId: auth.userId, name: "別間" } });
    const stranger = await createStudent(other.id);
    await prisma.student.update({ where: { id: stranger.id }, data: { lineUserId: "Uother" } });
    expect((await unbind(stranger.id)).status).toBe(404);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: stranger.id } })).lineUserId).toBe("Uother");
  });
});

describe("syncLineProfile — 學生開 LIFF 時更新 LINE 名稱與大頭照", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
  });

  const avatarOf = async (id: number) => (await prisma.student.findUniqueOrThrow({ where: { id } })).avatarUrl;

  it("舊綁定第一次抓到資料：預設頭像換成 LINE 的；之後老師改回預設就不再覆蓋", async () => {
    const s = await createStudent(classroomId);
    await prisma.student.update({ where: { id: s.id }, data: { lineUserId: "U1" } });

    await syncLineProfile("U1", { name: "阿明", picture: "https://profile.line-scdn.net/new" });
    const after = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    expect(after).toMatchObject({ lineDisplayName: "阿明", avatarUrl: "https://profile.line-scdn.net/new" });

    await prisma.student.update({ where: { id: s.id }, data: { avatarUrl: PRESET } });
    await syncLineProfile("U1", { name: "阿明", picture: "https://profile.line-scdn.net/new" });
    expect(await avatarOf(s.id)).toBe(PRESET);
  });

  it("LINE 改名、換照片會跟著更新；上傳的照片不動；別人的 LINE 不受影響", async () => {
    const uploaded = "https://res.cloudinary.com/demo/image/upload/b.jpg";
    const a = await createStudent(classroomId, { name: "A" });
    await prisma.student.update({
      where: { id: a.id },
      data: { lineUserId: "U2", lineDisplayName: "舊名", avatarUrl: LINE_PIC },
    });
    const b = await createStudent(classroomId, { name: "B" });
    await prisma.student.update({
      where: { id: b.id },
      data: { lineUserId: "U3", lineDisplayName: "B", avatarUrl: uploaded },
    });

    await syncLineProfile("U2", { name: "新名", picture: "https://profile.line-scdn.net/fresh" });
    await syncLineProfile("U3", { name: "B2", picture: "https://profile.line-scdn.net/b" });

    expect(await prisma.student.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      lineDisplayName: "新名",
      avatarUrl: "https://profile.line-scdn.net/fresh",
    });
    expect(await prisma.student.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      lineDisplayName: "B2",
      avatarUrl: uploaded,
    });
  });
});
