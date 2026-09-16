import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
} from "../factories";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

// 保留真實的 flex builders，只攔截外呼：測試絕不可打到真實 LINE API
// （CI 沒有正式 token，而且會真的發訊息給學生）。
const { pushes, pushResult } = vi.hoisted(() => ({
  pushes: [] as { to: string; messages: Record<string, unknown>[] }[],
  pushResult: { ok: true },
}));
vi.mock("@/lib/line", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/line")>();
  return {
    ...actual,
    pushMessage: async (to: string, messages: Record<string, unknown>[]) => {
      pushes.push({ to, messages });
      return pushResult.ok;
    },
  };
});

import { GET } from "@/app/api/cron/renewal-reminders/route";

const SECRET = "test-cron-secret";
const DAY = 24 * 60 * 60 * 1000;

let classroomId: number;
let cardId: number;
let prevSecret: string | undefined;
let prevAllowlist: string | undefined;

function cronRequest({ secret = SECRET, dryRun = false } = {}) {
  const url = `http://test.local/api/cron/renewal-reminders${dryRun ? "?dryRun=1" : ""}`;
  return new Request(url, {
    ...(secret === "" ? {} : { headers: { authorization: `Bearer ${secret}` } }),
  });
}

/** 一位綁好 LINE、課卡剛好用完、tag 也刷新過的學生。 */
async function exhaustedStudent(name = "Student", opts: { totalSessions?: number } = {}) {
  const student = await createStudent(classroomId, { name });
  await prisma.student.update({
    where: { id: student.id },
    data: { lineUserId: `line-${student.id}` },
  });
  const total = opts.totalSessions ?? 6;
  await createStudentCard(student.id, cardId, {
    remainingSessions: 0,
    totalSessions: total,
  });
  await refreshNeedsRenewalTag(student.id, classroomId);
  return student;
}

beforeEach(async () => {
  await resetDb();
  pushes.length = 0;
  pushResult.ok = true;
  const classroom = await createClassroom();
  classroomId = classroom.id;
  const card = await createCard(classroomId, { name: "六堂卡", sessions: 6 });
  cardId = card.id;

  prevSecret = process.env.CRON_SECRET;
  prevAllowlist = process.env.RENEWAL_REMINDER_CLASSROOM_IDS;
  process.env.CRON_SECRET = SECRET;
  process.env.RENEWAL_REMINDER_CLASSROOM_IDS = String(classroomId);
});

afterEach(() => {
  process.env.CRON_SECRET = prevSecret;
  process.env.RENEWAL_REMINDER_CLASSROOM_IDS = prevAllowlist;
});

describe("GET /api/cron/renewal-reminders — 授權", () => {
  it("沒帶 Authorization 回 401，且一則都不推", async () => {
    await exhaustedStudent();
    const res = await GET(cronRequest({ secret: "" }), { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    expect(pushes).toHaveLength(0);
  });

  it("secret 錯誤回 401", async () => {
    await exhaustedStudent();
    const res = await GET(cronRequest({ secret: "wrong" }), { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    expect(pushes).toHaveLength(0);
  });

  it("伺服器沒設 CRON_SECRET 時一律拒絕", async () => {
    await exhaustedStudent();
    delete process.env.CRON_SECRET;

    const res = await GET(cronRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    expect(pushes).toHaveLength(0);
  });
});

describe("GET /api/cron/renewal-reminders — 推播名單", () => {
  async function run({ dryRun = false } = {}) {
    const res = await GET(cronRequest({ dryRun }), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    return res.json();
  }

  it("卡用完 + 已綁 LINE + 教室啟用 → 推一則並落一筆紀錄", async () => {
    const student = await exhaustedStudent("小明");

    const body = await run();

    expect(body).toMatchObject({ scanned: 1, sent: 1, failed: 0 });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].to).toBe(`line-${student.id}`);
    expect(pushes[0].messages[0].altText).toBe("續卡提醒");
    expect(JSON.stringify(pushes[0].messages[0])).toContain("六堂卡");

    const reminders = await prisma.renewalReminder.findMany();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].studentId).toBe(student.id);
    expect(reminders[0].studentCardId).not.toBeNull();
  });

  it("沒綁 LINE 的學生不推", async () => {
    const student = await createStudent(classroomId, { name: "沒綁" });
    await createStudentCard(student.id, cardId, { remainingSessions: 0 });
    await refreshNeedsRenewalTag(student.id, classroomId);

    const body = await run();

    expect(body).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
  });

  it("還有剩餘堂數不推", async () => {
    const student = await createStudent(classroomId, { name: "還有堂數" });
    await prisma.student.update({
      where: { id: student.id },
      data: { lineUserId: "line-x" },
    });
    await createStudentCard(student.id, cardId, { remainingSessions: 2 });
    await refreshNeedsRenewalTag(student.id, classroomId);

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
  });

  it("單堂卡用完不算需要續卡", async () => {
    await exhaustedStudent("單堂", { totalSessions: 1 });

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
  });

  it("同卡種有較新的未用完卡就不推", async () => {
    const student = await exhaustedStudent("又買了");
    await createStudentCard(student.id, cardId, {
      remainingSessions: 6,
      createdAt: new Date(Date.now() + 1000),
    });

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
  });

  it("教室已封存不推", async () => {
    await exhaustedStudent();
    await prisma.classroom.update({
      where: { id: classroomId },
      data: { deletedAt: new Date() },
    });

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
  });

  it("教室不在白名單不推", async () => {
    await exhaustedStudent();
    process.env.RENEWAL_REMINDER_CLASSROOM_IDS = String(classroomId + 999);

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
  });

  it("白名單未設定時一間都不推（fail-closed）", async () => {
    await exhaustedStudent();
    delete process.env.RENEWAL_REMINDER_CLASSROOM_IDS;

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
  });

  it("tag 過期殘留時，複驗會擋下來", async () => {
    const student = await exhaustedStudent("補了卡但 tag 沒刷");
    // 直接補一張新卡、故意不呼叫 refreshNeedsRenewalTag：tag 還掛著。
    await createStudentCard(student.id, cardId, {
      remainingSessions: 6,
      createdAt: new Date(Date.now() + 1000),
    });

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
  });
});

describe("GET /api/cron/renewal-reminders — 冷卻期", () => {
  async function run() {
    const res = await GET(cronRequest(), { params: Promise.resolve({}) });
    return res.json();
  }

  it("14 天內推過就不再推", async () => {
    const student = await exhaustedStudent();
    await prisma.renewalReminder.create({
      data: { studentId: student.id, sentAt: new Date(Date.now() - 13 * DAY) },
    });

    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(0);
  });

  it("超過 14 天就再推一次", async () => {
    const student = await exhaustedStudent();
    await prisma.renewalReminder.create({
      data: { studentId: student.id, sentAt: new Date(Date.now() - 15 * DAY) },
    });

    expect(await run()).toMatchObject({ scanned: 1, sent: 1 });
    expect(await prisma.renewalReminder.count()).toBe(2);
  });

  it("連跑兩次只會推一次", async () => {
    await exhaustedStudent();

    expect(await run()).toMatchObject({ sent: 1 });
    expect(await run()).toMatchObject({ scanned: 0, sent: 0 });
    expect(pushes).toHaveLength(1);
  });
});

describe("GET /api/cron/renewal-reminders — 推播失敗與 dry run", () => {
  it("推播失敗不落紀錄，下一輪還會再試", async () => {
    await exhaustedStudent();
    pushResult.ok = false;

    const res = await GET(cronRequest(), { params: Promise.resolve({}) });
    expect(await res.json()).toMatchObject({ scanned: 1, sent: 0, failed: 1 });
    expect(await prisma.renewalReminder.count()).toBe(0);

    pushResult.ok = true;
    const retry = await GET(cronRequest(), { params: Promise.resolve({}) });
    expect(await retry.json()).toMatchObject({ sent: 1 });
  });

  it("dryRun 回名單但不推、不寫", async () => {
    const student = await exhaustedStudent("小明");

    const res = await GET(cronRequest({ dryRun: true }), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.dryRun).toBe(true);
    expect(body.scanned).toBe(1);
    expect(body.candidates[0]).toMatchObject({
      studentId: student.id,
      studentName: "小明",
      cardName: "六堂卡",
    });
    expect(pushes).toHaveLength(0);
    expect(await prisma.renewalReminder.count()).toBe(0);
  });
});
