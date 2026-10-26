import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent } from "../factories";

// Keep the real flex builders / constants, but stub the signature check (always
// valid) and capture outgoing replies instead of hitting LINE.
const { sent } = vi.hoisted(() => ({ sent: [] as Record<string, unknown>[][] }));
vi.mock("@/lib/line", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/line")>();
  return {
    ...actual,
    verifyLineSignature: () => true,
    replyMessage: async (_token: string, messages: Record<string, unknown>[]) => {
      sent.push(messages);
    },
  };
});

// LINE profile lookups (Messaging API) answer only for the ids listed here.
const { profiles } = vi.hoisted(() => ({
  profiles: {} as Record<string, { displayName: string; pictureUrl?: string }>,
}));
vi.mock("@/lib/lineProfile", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/lineProfile")>()),
  fetchLineProfile: async (lineUserId: string) => profiles[lineUserId] ?? null,
}));

import { POST } from "@/app/api/line/webhook/route";

function webhookRequest(event: Record<string, unknown>) {
  const req = new Request("http://test.local/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "sig", "content-type": "application/json" },
    body: JSON.stringify({ events: [event] }),
  });
  return req as unknown as NextRequest;
}
function textEvent(userId: string, text: string) {
  return {
    type: "message",
    replyToken: "r",
    source: { type: "user", userId },
    message: { type: "text", id: "1", text },
  };
}
function lastAltText(): string | undefined {
  const msgs = sent.at(-1);
  return msgs?.find((m) => typeof m.altText === "string")?.altText as string | undefined;
}
// The menu bubble's subtitle is "{name} 的學生選單" / "老師選單" — it lives in the
// bubble header alongside the "googoocard" brand line (header.contents[1]).
function lastSubtitle(): string | undefined {
  const msgs = sent.at(-1);
  const flex = msgs?.find((m) => m.type === "flex") as
    | { contents?: { header?: { contents?: { text?: string }[] } } }
    | undefined;
  return flex?.contents?.header?.contents?.[1]?.text;
}

const STUDENT_MENU = "googoocard 學生選單";

describe("POST /api/line/webhook — LINE 只給學生用", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
  });

  it("老師的舊綁定碼不再有作用、綁定的老師 LINE 只當一般好友", async () => {
    const classroom = await createClassroom();
    await prisma.user.update({ where: { id: classroom.ownerId }, data: { randomKey: "teacherKey", lineUserId: "lineTeacher" } });

    await POST(webhookRequest(textEvent("lineNew", "teacherKey")));
    expect((await prisma.user.findUnique({ where: { id: classroom.ownerId } }))?.lineUserId).toBe("lineTeacher");
    expect(lastAltText()).not.toBe(STUDENT_MENU);

    await POST(webhookRequest(textEvent("lineTeacher", "hi")));
    expect(JSON.stringify(sent.at(-1))).toContain("還沒有綁定學生身分");
  });
});

describe("POST /api/line/webhook — 綁定 (binding)", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
  });

  it("同教室已有綁定 → 自動換綁（舊學生解除、新學生綁上）", async () => {
    const classroom = await createClassroom();
    const a = await createStudent(classroom.id, { name: "A" });
    await prisma.student.update({
      where: { id: a.id },
      data: { lineUserId: "lineX", lineDisplayName: "小明", avatarUrl: "https://profile.line-scdn.net/x" },
    });
    const b = await createStudent(classroom.id, { name: "B" });
    await prisma.student.update({ where: { id: b.id }, data: { lineBindKey: "keyB" } });

    await POST(webhookRequest(textEvent("lineX", "keyB")));

    const aAfter = await prisma.student.findUnique({ where: { id: a.id } });
    const bAfter = await prisma.student.findUnique({ where: { id: b.id } });
    // The LINE name and picture leave with the binding.
    expect(aAfter).toMatchObject({ lineUserId: null, lineDisplayName: null, avatarUrl: "/images/avatars/not-sure.png" });
    expect(bAfter?.lineUserId).toBe("lineX");
    expect(bAfter?.lineBindKey).toBeNull();
    const acc = await prisma.lineAccount.findUnique({ where: { lineUserId: "lineX" } });
    expect(acc?.selectedStudentId).toBe(b.id);
    expect(lastAltText()).toBe(STUDENT_MENU);

    // Both sides land on the 動態 timeline.
    const [aEvent] = await prisma.event.findMany({ where: { studentId: a.id } });
    expect(aEvent).toMatchObject({ title: "解除 LINE 綁定", description: "這個 LINE 改綁到「B」" });
    const [bEvent] = await prisma.event.findMany({ where: { studentId: b.id } });
    expect(bEvent).toMatchObject({ title: "綁定 LINE", resourceType: "student", resourceId: b.id });
    expect(bEvent.description).toContain("原本綁在「A」");
  });

  it("綁定時抓 LINE 名稱與大頭照，寫一筆動態；同一個綁定碼再送一次不會重複寫", async () => {
    profiles.lineS = { displayName: "小S", pictureUrl: "https://profile.line-scdn.net/s" };
    const classroom = await createClassroom();
    const s = await createStudent(classroom.id, { name: "S" });
    await prisma.student.update({ where: { id: s.id }, data: { lineBindKey: "keyS" } });

    await POST(webhookRequest(textEvent("lineS", "keyS")));
    await POST(webhookRequest(textEvent("lineS", "keyS")));

    const after = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    expect(after).toMatchObject({ lineDisplayName: "小S", avatarUrl: "https://profile.line-scdn.net/s" });
    const events = await prisma.event.findMany({ where: { studentId: s.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: "綁定 LINE", description: "LINE 名稱「小S」" });
  });

  it("老師上傳的大頭照不會被 LINE 的換掉；抓不到 LINE 資料也照樣綁定", async () => {
    profiles.lineU = { displayName: "小U", pictureUrl: "https://profile.line-scdn.net/u" };
    const classroom = await createClassroom();
    const uploaded = "https://res.cloudinary.com/demo/image/upload/u.jpg";
    const u = await createStudent(classroom.id, { name: "U" });
    await prisma.student.update({ where: { id: u.id }, data: { lineBindKey: "keyU", avatarUrl: uploaded } });
    const n = await createStudent(classroom.id, { name: "N" });
    await prisma.student.update({ where: { id: n.id }, data: { lineBindKey: "keyN" } });

    await POST(webhookRequest(textEvent("lineU", "keyU")));
    await POST(webhookRequest(textEvent("lineNoFriend", "keyN")));

    expect(await prisma.student.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({
      lineDisplayName: "小U",
      avatarUrl: uploaded,
    });
    expect(await prisma.student.findUniqueOrThrow({ where: { id: n.id } })).toMatchObject({
      lineUserId: "lineNoFriend",
      lineDisplayName: null,
      avatarUrl: "/images/avatars/not-sure.png",
    });
    const [nEvent] = await prisma.event.findMany({ where: { studentId: n.id } });
    expect(nEvent.description).toBe("學生用 LINE 送出綁定碼");
  });

  it("不同教室 → 兩位學生都保留綁定", async () => {
    const c1 = await createClassroom();
    const a = await createStudent(c1.id, { name: "A" });
    await prisma.student.update({ where: { id: a.id }, data: { lineUserId: "lineY" } });

    const owner2 = await prisma.user.create({
      data: { email: "owner2@test.local", name: "O2", password: "x" },
    });
    const c2 = await prisma.classroom.create({ data: { ownerId: owner2.id, name: "C2" } });
    const c = await createStudent(c2.id, { name: "C" });
    await prisma.student.update({ where: { id: c.id }, data: { lineBindKey: "keyC" } });

    await POST(webhookRequest(textEvent("lineY", "keyC")));

    const aAfter = await prisma.student.findUnique({ where: { id: a.id } });
    const cAfter = await prisma.student.findUnique({ where: { id: c.id } });
    expect(aAfter?.lineUserId).toBe("lineY");
    expect(cAfter?.lineUserId).toBe("lineY");
  });
});

describe("POST /api/line/webhook — selectedStudentId 決定選單顯示哪位學生", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
  });

  it("預設顯示第一位；設定 selectedStudentId 後改顯示該位", async () => {
    const c1 = await createClassroom();
    const amy = await createStudent(c1.id, { name: "Amy" });
    await prisma.student.update({ where: { id: amy.id }, data: { lineUserId: "lineMulti" } });

    const owner2 = await prisma.user.create({
      data: { email: "owner2@test.local", name: "O2", password: "x" },
    });
    const c2 = await prisma.classroom.create({ data: { ownerId: owner2.id, name: "C2" } });
    const bob = await createStudent(c2.id, { name: "Bob" });
    await prisma.student.update({ where: { id: bob.id }, data: { lineUserId: "lineMulti" } });

    // Default → first bound student (Amy, lower id).
    await POST(webhookRequest(textEvent("lineMulti", "hi")));
    expect(lastSubtitle()).toContain("Amy");

    // After selecting Bob (what /api/liff/select-student does) → menu shows Bob.
    await prisma.lineAccount.upsert({
      where: { lineUserId: "lineMulti" },
      update: { selectedStudentId: bob.id },
      create: { lineUserId: "lineMulti", selectedStudentId: bob.id },
    });
    await POST(webhookRequest(textEvent("lineMulti", "hi")));
    expect(lastSubtitle()).toContain("Bob");
  });
});
