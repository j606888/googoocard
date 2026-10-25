import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  jsonRequest,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

// 攔下對 Expo 的外呼：測試絕不可真的發推播。保留真的 isExpoPushToken 驗證。
const expo = vi.hoisted(() => ({
  sent: [] as { to: string; title: string; body: string; badge?: number; data?: Record<string, unknown> }[],
  deadTokens: new Set<string>(),
  fail: false,
}));
vi.mock("@/lib/expoPush", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/expoPush")>();
  return {
    ...actual,
    sendExpoPush: async (messages: typeof expo.sent) => {
      if (expo.fail) throw new Error("expo down");
      expo.sent.push(...messages);
      return messages.map((m) =>
        expo.deadTokens.has(m.to)
          ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
          : { status: "ok", id: "ticket" }
      );
    },
  };
});

// LIFF ID token 由 LINE 驗證——token 字串直接當 lineUserId。
vi.mock("@/lib/line", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/line")>();
  return {
    ...actual,
    verifyIdToken: async (token: string) => (token ? { userId: token } : null),
  };
});

import { GET as GET_TODOS } from "@/app/api/todos/route";
import { POST as POST_TOKEN, DELETE as DELETE_TOKEN } from "@/app/api/push-tokens/route";
import {
  GET as GET_PREFS,
  PUT as PUT_PREFS,
} from "@/app/api/notification-preferences/route";
import { POST as LIFF_BUY } from "@/app/api/liff/student-cards/route";
import { notifyClassroom } from "@/service/push";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { selfCheckIn } from "@/domains/attendance/attendance.service";

const TOKEN_A = "ExponentPushToken[aaa]";
const TOKEN_B = "ExponentPushToken[bbb]";

let classroomId: number;

async function registerToken(userId: number, token: string) {
  await prisma.pushToken.create({ data: { userId, token, platform: "ios" } });
}

beforeEach(async () => {
  await resetDb();
  const classroom = await createClassroom();
  classroomId = classroom.id;
  auth.userId = 1;
  auth.classroomId = classroomId;
  expo.sent.length = 0;
  expo.deadTokens.clear();
  expo.fail = false;
});

describe("GET /api/todos", () => {
  it("列出三類待處理，總數相符", async () => {
    const card = await createCard(classroomId, { name: "10 堂卡" });
    const payer = await createStudent(classroomId, { name: "欠款" });
    await createStudentCard(payer.id, card.id, { isPaid: false });

    const renewer = await createStudent(classroomId, { name: "用完" });
    await createStudentCard(renewer.id, card.id, { remainingSessions: 0 });
    await refreshNeedsRenewalTag(renewer.id, classroomId);

    const { lesson, period } = await createLesson(classroomId, { withPeriod: true });
    const walkIn = await createStudent(classroomId, { name: "沒卡" });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: walkIn.id },
    });

    const res = await GET_TODOS(new Request("http://test.local/api/todos"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.unpaidCards.map((c: { student: { name: string } }) => c.student.name)).toEqual(["欠款"]);
    expect(body.unpaidCards[0].cardName).toBe("10 堂卡");
    expect(body.needsRenewal.map((r: { student: { name: string } }) => r.student.name)).toEqual(["用完"]);
    expect(body.unboundAttendance).toHaveLength(1);
    expect(body.unboundAttendance[0]).toMatchObject({
      lessonId: lesson.id,
      lessonPeriodId: period!.id,
      student: { name: "沒卡" },
    });
    expect(body.total).toBe(3);
  });

  it("其他教室的事項不會出現", async () => {
    const other = await createClassroom({ name: "別間", email: "other@test.local" });
    const card = await createCard(other.id);
    const student = await createStudent(other.id);
    await createStudentCard(student.id, card.id, { isPaid: false });

    const body = await (
      await GET_TODOS(new Request("http://test.local/api/todos"), { params: Promise.resolve({}) })
    ).json();
    expect(body.total).toBe(0);
  });

  it("封存學生不列入需續約，但未付款照列", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { remainingSessions: 0, isPaid: false });
    await refreshNeedsRenewalTag(student.id, classroomId);
    await prisma.student.update({ where: { id: student.id }, data: { archivedAt: new Date() } });

    const body = await (
      await GET_TODOS(new Request("http://test.local/api/todos"), { params: Promise.resolve({}) })
    ).json();
    expect(body.needsRenewal).toHaveLength(0);
    expect(body.unpaidCards).toHaveLength(1);
  });
});

describe("GET /api/todos（追帳與可能重複）", () => {
  const getTodos = async () =>
    (await GET_TODOS(new Request("http://test.local/api/todos"), { params: Promise.resolve({}) })).json();

  it("未付款依拖欠時間排序（最久的在前），帶已用堂數", async () => {
    const card = await createCard(classroomId);
    const a = await createStudent(classroomId, { name: "新欠" });
    const b = await createStudent(classroomId, { name: "舊欠" });
    await createStudentCard(a.id, card.id, { isPaid: false, createdAt: new Date("2026-10-20") });
    await createStudentCard(b.id, card.id, {
      isPaid: false,
      createdAt: new Date("2026-10-01"),
      totalSessions: 10,
      remainingSessions: 2,
    });

    const body = await getTodos();
    expect(body.unpaidCards.map((c: { student: { name: string } }) => c.student.name)).toEqual(["舊欠", "新欠"]);
    expect(body.unpaidCards[0]).toMatchObject({ usedSessions: 8, totalSessions: 10 });
  });

  it("同名（不分大小寫、去空白）的在籍學生列為可能重複，封存的不算，計入總數", async () => {
    const old = await createStudent(classroomId, { name: "Mei" });
    const fresh = await createStudent(classroomId, { name: " mei " });
    await prisma.student.update({ where: { id: fresh.id }, data: { lineUserId: "U1" } });
    const gone = await createStudent(classroomId, { name: "Ben" });
    await createStudent(classroomId, { name: "Ben" });
    await prisma.student.update({ where: { id: gone.id }, data: { archivedAt: new Date() } });

    const body = await getTodos();
    expect(body.possibleDuplicates).toHaveLength(1);
    expect(body.possibleDuplicates[0].students.map((s: { id: number }) => s.id)).toEqual([old.id, fresh.id]);
    expect(body.possibleDuplicates[0].students[1]).toMatchObject({ lineBound: true });
    expect(body.possibleDuplicates[0].students[1]).not.toHaveProperty("lineUserId");
    expect(body.total).toBe(1);
  });
});

describe("/api/push-tokens", () => {
  it("註冊 token；不是 Expo token → 400", async () => {
    const bad = await POST_TOKEN(jsonRequest("POST", { token: "abc", platform: "ios" }), {
      params: Promise.resolve({}),
    });
    expect(bad.status).toBe(400);

    const res = await POST_TOKEN(jsonRequest("POST", { token: TOKEN_A, platform: "ios" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(await prisma.pushToken.findMany()).toMatchObject([{ token: TOKEN_A, userId: 1 }]);
  });

  it("同一支手機換帳號登入 → token 改掛到新帳號", async () => {
    const assistant = await createMember(classroomId);
    await registerToken(1, TOKEN_A);

    auth.userId = assistant.id;
    await POST_TOKEN(jsonRequest("POST", { token: TOKEN_A, platform: "ios" }), {
      params: Promise.resolve({}),
    });
    expect(await prisma.pushToken.findMany()).toMatchObject([{ token: TOKEN_A, userId: assistant.id }]);
  });

  it("DELETE 只刪自己的 token", async () => {
    const assistant = await createMember(classroomId);
    await registerToken(assistant.id, TOKEN_A);

    await DELETE_TOKEN(jsonRequest("DELETE", { token: TOKEN_A }), { params: Promise.resolve({}) });
    expect(await prisma.pushToken.count()).toBe(1);

    auth.userId = assistant.id;
    await DELETE_TOKEN(jsonRequest("DELETE", { token: TOKEN_A }), { params: Promise.resolve({}) });
    expect(await prisma.pushToken.count()).toBe(0);
  });
});

describe("/api/notification-preferences", () => {
  it("預設全開，關掉一類後只影響那一類", async () => {
    const before = await (await GET_PREFS(new Request("http://test.local"), { params: Promise.resolve({}) })).json();
    expect(before).toEqual({ UNPAID_CARD: true, NEEDS_RENEWAL: true, UNBOUND_ATTENDANCE: true });

    const put = await PUT_PREFS(jsonRequest("PUT", { type: "NEEDS_RENEWAL", enabled: false }), {
      params: Promise.resolve({}),
    });
    expect(put.status).toBe(200);

    const after = await (await GET_PREFS(new Request("http://test.local"), { params: Promise.resolve({}) })).json();
    expect(after).toEqual({ UNPAID_CARD: true, NEEDS_RENEWAL: false, UNBOUND_ATTENDANCE: true });
  });

  it("不認得的類別 → 400", async () => {
    const res = await PUT_PREFS(jsonRequest("PUT", { type: "NOPE", enabled: false }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("notifyClassroom", () => {
  const push = { type: "UNPAID_CARD" as const, title: "t", body: "b", path: "/x" };

  it("推給 owner 與助教，不推給其他教室的人；badge = 待處理總數", async () => {
    const assistant = await createMember(classroomId);
    const other = await createClassroom({ name: "別間", email: "other@test.local" });
    const outsider = await prisma.membership.findFirstOrThrow({ where: { classroomId: other.id } });
    await registerToken(1, TOKEN_A);
    await registerToken(assistant.id, TOKEN_B);
    await registerToken(outsider.userId, "ExponentPushToken[outsider]");

    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { isPaid: false });

    await notifyClassroom(classroomId, push);
    expect(expo.sent.map((m) => m.to).sort()).toEqual([TOKEN_A, TOKEN_B]);
    expect(expo.sent[0]).toMatchObject({
      badge: 1,
      data: { classroomId, type: "UNPAID_CARD", path: "/x" },
    });
  });

  it("關掉這一類的人不收", async () => {
    const assistant = await createMember(classroomId);
    await registerToken(1, TOKEN_A);
    await registerToken(assistant.id, TOKEN_B);
    await prisma.notificationPreference.create({
      data: { userId: assistant.id, classroomId, type: "UNPAID_CARD", enabled: false },
    });

    await notifyClassroom(classroomId, push);
    expect(expo.sent.map((m) => m.to)).toEqual([TOKEN_A]);
  });

  it("封存的教室不發", async () => {
    await registerToken(1, TOKEN_A);
    await prisma.classroom.update({ where: { id: classroomId }, data: { deletedAt: new Date() } });

    await notifyClassroom(classroomId, push);
    expect(expo.sent).toHaveLength(0);
  });

  it("DeviceNotRegistered 的 token 會被刪掉", async () => {
    await registerToken(1, TOKEN_A);
    await registerToken(1, TOKEN_B);
    expo.deadTokens.add(TOKEN_B);

    await notifyClassroom(classroomId, push);
    expect((await prisma.pushToken.findMany()).map((t) => t.token)).toEqual([TOKEN_A]);
  });

  it("Expo 掛掉不會 throw", async () => {
    await registerToken(1, TOKEN_A);
    expo.fail = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyClassroom(classroomId, push)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("觸發點", () => {
  beforeEach(async () => {
    await registerToken(1, TOKEN_A);
  });

  it("需續約：只在 tag 新加上時推一次，拿掉再加上會再推", async () => {
    const card = await createCard(classroomId, { name: "8 堂卡" });
    const student = await createStudent(classroomId, { name: "小明" });
    const sc = await createStudentCard(student.id, card.id, { remainingSessions: 0 });

    await refreshNeedsRenewalTag(student.id, classroomId);
    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(expo.sent).toHaveLength(1);
    expect(expo.sent[0]).toMatchObject({
      title: "需續約",
      body: "小明 的「8 堂卡」用完了",
      data: { type: "NEEDS_RENEWAL", path: `/students/${student.id}` },
    });

    // 買了新卡 → tag 拿掉；新卡又用完 → 再推一次。
    await prisma.studentCard.update({ where: { id: sc.id }, data: { expiredAt: new Date() } });
    const fresh = await createStudentCard(student.id, card.id, { remainingSessions: 3 });
    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(expo.sent).toHaveLength(1);

    await prisma.studentCard.update({ where: { id: fresh.id }, data: { remainingSessions: 0 } });
    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(expo.sent).toHaveLength(2);
  });

  it("需續約：並發 refresh 也只推一次", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { remainingSessions: 0 });

    await Promise.all([
      refreshNeedsRenewalTag(student.id, classroomId),
      refreshNeedsRenewalTag(student.id, classroomId),
      refreshNeedsRenewalTag(student.id, classroomId),
    ]);
    expect(expo.sent).toHaveLength(1);
  });

  it("需續約：封存學生不推", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await prisma.student.update({ where: { id: student.id }, data: { archivedAt: new Date() } });
    await createStudentCard(student.id, card.id, { remainingSessions: 0 });

    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(expo.sent).toHaveLength(0);
  });

  it("待確認收款：學生在 LIFF 自助買卡 → 推一則", async () => {
    const card = await createCard(classroomId, { name: "10 堂卡" });
    const student = await createStudent(classroomId, { name: "小美" });
    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "lineA" } });

    const res = await LIFF_BUY(
      new Request("http://test.local/api/liff/student-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer lineA" },
        body: JSON.stringify({ studentId: student.id, cardId: card.id }),
      })
    );
    expect(res.status).toBe(200);

    expect(expo.sent).toHaveLength(1);
    expect(expo.sent[0].title).toBe("待確認收款");
    expect(expo.sent[0].body).toContain("小美 自助購買了「10 堂卡」");
    expect(expo.sent[0].data).toMatchObject({ type: "UNPAID_CARD", path: `/students/${student.id}` });
  });

  it("出席沒有課卡：自助簽到沒卡可扣 → 推一則；有卡則不推", async () => {
    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, {
      name: "週二 Bachata",
      cardIds: [card.id],
      withPeriod: true,
    });
    const noCard = await createStudent(classroomId, { name: "沒卡" });
    const withCard = await createStudent(classroomId, { name: "有卡" });
    await createStudentCard(withCard.id, card.id, { remainingSessions: 5 });

    await selfCheckIn({ studentId: withCard.id, lessonId: lesson.id, lessonPeriodIds: [period!.id] });
    expect(expo.sent).toHaveLength(0);

    await selfCheckIn({ studentId: noCard.id, lessonId: lesson.id, lessonPeriodIds: [period!.id] });
    expect(expo.sent).toHaveLength(1);
    expect(expo.sent[0]).toMatchObject({
      title: "出席沒有課卡",
      body: "沒卡 自助簽到了「週二 Bachata」，但沒有可用的課卡",
      data: {
        type: "UNBOUND_ATTENDANCE",
        path: `/lessons/${lesson.id}/periods/${period!.id}/check-success`,
      },
    });
  });
});
