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

import { POST } from "@/app/api/line/webhook/route";
import { SWITCH_TO_STUDENT, SWITCH_TO_TEACHER } from "@/lib/line";

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
function postbackEvent(userId: string, data: string) {
  return { type: "postback", replyToken: "r", source: { type: "user", userId }, data: undefined, postback: { data } };
}
function lastAltText(): string | undefined {
  const msgs = sent.at(-1);
  return msgs?.find((m) => typeof m.altText === "string")?.altText as string | undefined;
}
// The menu bubble's subtitle is "{name} 的學生選單" / "老師選單".
function lastSubtitle(): string | undefined {
  const msgs = sent.at(-1);
  const flex = msgs?.find((m) => m.type === "flex") as
    | { contents?: { body?: { contents?: { text?: string }[] } } }
    | undefined;
  return flex?.contents?.body?.contents?.[1]?.text;
}

const STUDENT_MENU = "googoocard 學生選單";
const TEACHER_MENU = "googoocard 老師選單";

describe("POST /api/line/webhook — 選單記憶 (menu mode)", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
  });

  it("同時是老師與學生：切到學生選單後會記憶，之後一般訊息預設仍為學生選單", async () => {
    const classroom = await createClassroom();
    await prisma.user.update({
      where: { id: classroom.ownerId },
      data: { lineUserId: "lineBoth" },
    });
    const student = await createStudent(classroom.id, { name: "Amy" });
    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "lineBoth" } });

    // Default before any switch → teacher menu wins.
    await POST(webhookRequest(textEvent("lineBoth", "hi")));
    expect(lastAltText()).toBe(TEACHER_MENU);

    // Switch to student → persisted.
    await POST(webhookRequest(postbackEvent("lineBoth", SWITCH_TO_STUDENT)));
    expect(lastAltText()).toBe(STUDENT_MENU);
    const acc = await prisma.lineAccount.findUnique({ where: { lineUserId: "lineBoth" } });
    expect(acc?.menuMode).toBe("STUDENT");

    // A later plain message defaults to the remembered student menu.
    await POST(webhookRequest(textEvent("lineBoth", "hi again")));
    expect(lastAltText()).toBe(STUDENT_MENU);

    // Switching back to teacher is also remembered.
    await POST(webhookRequest(postbackEvent("lineBoth", SWITCH_TO_TEACHER)));
    await POST(webhookRequest(textEvent("lineBoth", "yet again")));
    expect(lastAltText()).toBe(TEACHER_MENU);
  });
});

describe("POST /api/line/webhook — 綁定 (binding)", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
  });

  it("同教室已有綁定 → 自動換綁（舊學生解除、新學生綁上、menuMode=STUDENT）", async () => {
    const classroom = await createClassroom();
    const a = await createStudent(classroom.id, { name: "A" });
    await prisma.student.update({ where: { id: a.id }, data: { lineUserId: "lineX" } });
    const b = await createStudent(classroom.id, { name: "B" });
    await prisma.student.update({ where: { id: b.id }, data: { lineBindKey: "keyB" } });

    await POST(webhookRequest(textEvent("lineX", "keyB")));

    const aAfter = await prisma.student.findUnique({ where: { id: a.id } });
    const bAfter = await prisma.student.findUnique({ where: { id: b.id } });
    expect(aAfter?.lineUserId).toBeNull();
    expect(bAfter?.lineUserId).toBe("lineX");
    expect(bAfter?.lineBindKey).toBeNull();
    const acc = await prisma.lineAccount.findUnique({ where: { lineUserId: "lineX" } });
    expect(acc?.menuMode).toBe("STUDENT");
    expect(acc?.selectedStudentId).toBe(b.id);
    expect(lastAltText()).toBe(STUDENT_MENU);
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
