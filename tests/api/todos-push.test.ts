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
import { getTodos } from "@/service/todos";
import { refreshLesson } from "@/service/lesson";
import { selfCheckIn } from "@/domains/attendance/attendance.service";

const TOKEN_A = "ExponentPushToken[aaa]";
const TOKEN_B = "ExponentPushToken[bbb]";

let classroomId: number;

/** 幾天前上過一堂課、用了這張卡（建一堂只有那個時段的課）。 */
async function attendRecently(studentId: number, studentCardId: number, daysAgo: number) {
  const { lesson } = await createLesson(classroomId);
  const startTime = new Date(Date.now() - daysAgo * 86_400_000);
  const period = await prisma.lessonPeriod.create({
    data: {
      lessonId: lesson.id,
      startTime,
      endTime: new Date(startTime.getTime() + 3_600_000),
      attendanceTakenAt: startTime,
    },
  });
  return prisma.attendanceRecord.create({
    data: { lessonPeriodId: period.id, studentId, studentCardId },
  });
}

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
  it("列出三類待處理；紅色數字（total）只算未付款＋沒綁卡", async () => {
    const card = await createCard(classroomId, { name: "10 堂卡" });
    const payer = await createStudent(classroomId, { name: "欠款" });
    await createStudentCard(payer.id, card.id, { isPaid: false });

    const renewer = await createStudent(classroomId, { name: "用完" });
    const used = await createStudentCard(renewer.id, card.id, { remainingSessions: 0 });
    await attendRecently(renewer.id, used.id, 3);
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
    expect(body.urgentCount).toBe(2);
    expect(body.total).toBe(2);
    expect(body.reminderCount).toBe(1);
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
    expect(body.reminderCount).toBe(1);
    expect(body.total).toBe(0);
  });
});

describe("已經沒卡（需續約的規則）", () => {
  const renewalNames = async () =>
    (await getTodos(classroomId)).needsRenewal.map((r) => r.student.name);

  it("還有別張能用的卡就不算；那張也用完才算", async () => {
    const cardA = await createCard(classroomId, { name: "A 卡" });
    const cardB = await createCard(classroomId, { name: "B 卡" });
    const student = await createStudent(classroomId, { name: "兩張卡" });
    const usedUp = await createStudentCard(student.id, cardA.id, { remainingSessions: 0 });
    const other = await createStudentCard(student.id, cardB.id, { remainingSessions: 3 });
    await attendRecently(student.id, usedUp.id, 2);

    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(await renewalNames()).toEqual([]);

    await prisma.studentCard.update({ where: { id: other.id }, data: { remainingSessions: 0 } });
    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(await renewalNames()).toEqual(["兩張卡"]);
  });

  it("tag 還掛著、但手上已經有能用的卡：名單照樣不列", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    const usedUp = await createStudentCard(student.id, card.id, { remainingSessions: 0 });
    await attendRecently(student.id, usedUp.id, 2);
    await refreshNeedsRenewalTag(student.id, classroomId);
    // 故意不刷新 tag。
    await createStudentCard(student.id, card.id, { remainingSessions: 5 });
    expect(await renewalNames()).toEqual([]);
  });

  it("整期報名期間不算沒卡，課結束之後才算", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId, { name: "整期生" });
    const usedUp = await createStudentCard(student.id, card.id, { remainingSessions: 0 });
    await attendRecently(student.id, usedUp.id, 2);
    const { lesson } = await createLesson(classroomId);
    await prisma.lessonEnrollment.create({
      data: { lessonId: lesson.id, studentId: student.id, price: 2400, sessions: 6, isPaid: true },
    });

    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(await renewalNames()).toEqual([]);

    // 手動結束這門課 → refreshLesson 連整期學生的 tag 一起重算。
    await prisma.lesson.update({ where: { id: lesson.id }, data: { endedAt: new Date() } });
    await refreshLesson(lesson.id);
    expect(await renewalNames()).toEqual(["整期生"]);
  });

  it("只有體驗卡、沒買過多堂卡的人不算續卡", async () => {
    const trial = await createCard(classroomId, { name: "體驗課", isTrial: true, sessions: 1 });
    const student = await createStudent(classroomId);
    const used = await createStudentCard(student.id, trial.id, { remainingSessions: 0, totalSessions: 1 });
    await attendRecently(student.id, used.id, 1);
    await refreshNeedsRenewalTag(student.id, classroomId);
    expect(await renewalNames()).toEqual([]);
  });
});

describe("GET /api/todos?scope=mine（我的課）", () => {
  const getMine = async () =>
    (
      await GET_TODOS(new Request("http://test.local/api/todos?scope=mine"), { params: Promise.resolve({}) })
    ).json();

  /** 一門有一堂（幾天前）的課；`teacherId` 教，`assistantId` 當小幫手。 */
  async function lessonOf({ teacherId, assistantId }: { teacherId?: number; assistantId?: number }, daysAgo = 1) {
    const { lesson } = await createLesson(classroomId);
    if (teacherId) await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId } });
    if (assistantId) await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: assistantId } });
    const startTime = new Date(Date.now() - daysAgo * 86_400_000);
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3_600_000), attendanceTakenAt: startTime },
    });
    return { lesson, period };
  }

  it("只留我教的＋我當小幫手的課；全教室才有的（沒用過的未付卡、可能重複）不列", async () => {
    const me = await prisma.teacher.create({ data: { name: "我", classroomId, userId: auth.userId } });
    const other = await prisma.teacher.create({ data: { name: "別人", classroomId } });
    const taught = await lessonOf({ teacherId: me.id });
    const assisted = await lessonOf({ teacherId: other.id, assistantId: me.id });
    const theirs = await lessonOf({ teacherId: other.id });
    const card = await createCard(classroomId);

    // 出席沒綁卡：三堂各一位。
    const names = ["我教的", "我協助的", "別人的"];
    const students = await Promise.all(names.map((name) => createStudent(classroomId, { name })));
    for (const [i, { period }] of [taught, assisted, theirs].entries()) {
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: students[i].id } });
    }

    // 未付的卡：一張在我的課扣過、一張在別人的課扣過、一張還沒用。
    const payers = await Promise.all(["用在我的課", "用在別人的課", "還沒用"].map((name) => createStudent(classroomId, { name })));
    const [mineCard, theirCard] = await Promise.all(
      payers.slice(0, 2).map((s) => createStudentCard(s.id, card.id, { isPaid: false }))
    );
    await createStudentCard(payers[2].id, card.id, { isPaid: false });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: taught.period.id, studentId: payers[0].id, studentCardId: mineCard.id },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: theirs.period.id, studentId: payers[1].id, studentCardId: theirCard.id },
    });

    // 整期未付：我的課一筆、別人的課一筆。
    await prisma.lessonEnrollment.create({
      data: { lessonId: assisted.lesson.id, studentId: payers[0].id, price: 2400, sessions: 6 },
    });
    await prisma.lessonEnrollment.create({
      data: { lessonId: theirs.lesson.id, studentId: payers[1].id, price: 2400, sessions: 6 },
    });

    // 已經沒卡：一位來過我的課、一位只來過別人的課。
    const renewers = await Promise.all(["來過我的課", "只來別人的課"].map((name) => createStudent(classroomId, { name })));
    for (const [i, { period }] of [taught, theirs].entries()) {
      const usedUp = await createStudentCard(renewers[i].id, card.id, { remainingSessions: 0 });
      await prisma.attendanceRecord.create({
        data: { lessonPeriodId: period.id, studentId: renewers[i].id, studentCardId: usedUp.id },
      });
      await refreshNeedsRenewalTag(renewers[i].id, classroomId);
    }

    // 可能重複：整間教室的事。
    await createStudent(classroomId, { name: "我教的" });

    const mine = await getMine();
    const studentNames = (rows: { student: { name: string } }[]) => rows.map((r) => r.student.name).sort();
    expect(studentNames(mine.unboundAttendance)).toEqual(["我協助的", "我教的"]);
    expect(studentNames(mine.unpaidCards)).toEqual(["用在我的課"]);
    expect(mine.unpaidCards[0].usedIn).toEqual([
      { lessonId: taught.lesson.id, lessonPeriodId: taught.period.id, startTime: taught.period.startTime.toISOString() },
    ]);
    expect(studentNames(mine.unpaidEnrollments)).toEqual(["用在我的課"]);
    expect(studentNames(mine.needsRenewal)).toEqual(["來過我的課"]);
    expect(mine.possibleDuplicates).toEqual([]);
    expect(mine.inactiveRenewalCount).toBe(0);
    expect(mine.urgentCount).toBe(4);

    const all = await (
      await GET_TODOS(new Request("http://test.local/api/todos"), { params: Promise.resolve({}) })
    ).json();
    expect(all.unboundAttendance).toHaveLength(3);
    expect(all.unpaidCards).toHaveLength(3);
    expect(all.needsRenewal).toHaveLength(2);
    expect(all.possibleDuplicates).toHaveLength(1);
  });

  it("沒連老師資料的人：我的課是空的", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await createStudentCard(student.id, card.id, { isPaid: false });
    const mine = await getMine();
    expect(mine.unpaidCards).toEqual([]);
    expect(mine.total).toBe(0);
  });
});

describe("GET /api/todos（提醒）", () => {
  const getTodos = async () =>
    (await GET_TODOS(new Request("http://test.local/api/todos"), { params: Promise.resolve({}) })).json();

  it("需續約只列 7 天內有來上課的人，更久沒來的只算人數；不進紅色數字", async () => {
    const card = await createCard(classroomId);
    const recent = await createStudent(classroomId, { name: "最近有來" });
    const recentCard = await createStudentCard(recent.id, card.id, { remainingSessions: 0 });
    await attendRecently(recent.id, recentCard.id, 5);
    await refreshNeedsRenewalTag(recent.id, classroomId);

    const gone = await createStudent(classroomId, { name: "很久沒來" });
    const goneCard = await createStudentCard(gone.id, card.id, { remainingSessions: 0 });
    await attendRecently(gone.id, goneCard.id, 10);
    await refreshNeedsRenewalTag(gone.id, classroomId);

    const never = await createStudent(classroomId, { name: "沒出席紀錄" });
    await createStudentCard(never.id, card.id, { remainingSessions: 0 });
    await refreshNeedsRenewalTag(never.id, classroomId);

    const body = await getTodos();
    expect(body.needsRenewal.map((r: { student: { name: string } }) => r.student.name)).toEqual(["最近有來"]);
    expect(body.needsRenewal[0]).toMatchObject({ lineBound: false, lastRemindedAt: null });
    expect(body.needsRenewal[0].student).not.toHaveProperty("lineUserId");
    expect(body.inactiveRenewalCount).toBe(2);
    expect(body.reminderCount).toBe(1);
    expect(body.total).toBe(0);
  });

  it("LINE 已提醒只算這次用完之後發的", async () => {
    const card = await createCard(classroomId);
    const student = await createStudent(classroomId);
    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "U1" } });
    const sc = await createStudentCard(student.id, card.id, { remainingSessions: 0 });
    await attendRecently(student.id, sc.id, 2);
    await prisma.renewalReminder.create({
      data: { studentId: student.id, sentAt: new Date(Date.now() - 60 * 86_400_000) },
    });
    await refreshNeedsRenewalTag(student.id, classroomId);

    let body = await getTodos();
    expect(body.needsRenewal[0]).toMatchObject({ lineBound: true, lastRemindedAt: null });

    await prisma.renewalReminder.create({ data: { studentId: student.id } });
    body = await getTodos();
    expect(body.needsRenewal[0].lastRemindedAt).not.toBeNull();
  });

  it("14 天內上過體驗課、沒買過正式卡的列進體驗後還沒買卡", async () => {
    const trial = await createCard(classroomId, { name: "體驗課", isTrial: true, price: 300, sessions: 1 });
    const regular = await createCard(classroomId, { name: "8 堂卡" });

    const fresh = await createStudent(classroomId, { name: "剛體驗" });
    const freshTrial = await createStudentCard(fresh.id, trial.id, { remainingSessions: 0, totalSessions: 1 });
    await attendRecently(fresh.id, freshTrial.id, 3);

    const bought = await createStudent(classroomId, { name: "已買卡" });
    const boughtTrial = await createStudentCard(bought.id, trial.id, { remainingSessions: 0, totalSessions: 1 });
    await attendRecently(bought.id, boughtTrial.id, 3);
    await createStudentCard(bought.id, regular.id);

    const old = await createStudent(classroomId, { name: "太久以前" });
    const oldTrial = await createStudentCard(old.id, trial.id, { remainingSessions: 0, totalSessions: 1 });
    await attendRecently(old.id, oldTrial.id, 20);

    const body = await getTodos();
    expect(body.trialFollowUps.map((t: { student: { name: string } }) => t.student.name)).toEqual(["剛體驗"]);
    expect(body.reminderCount).toBe(1);
    expect(body.total).toBe(0);
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

  it("推給 owner 與助教，不推給其他教室的人；badge = 要處理的數字", async () => {
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
