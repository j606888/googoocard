import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent } from "../factories";

// Token string IS the lineUserId; "bad" → invalid. Profile comes back for any
// valid token so the pre-fill path is exercised.
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad"
      ? { userId: token, name: `LINE-${token}`, picture: `https://profile.line-scdn.net/${token}` }
      : null,
}));

import { POST as register } from "@/app/api/liff/register/route";
import { GET as me } from "@/app/api/liff/me/route";

const KEY = "wallKey123";

function registerRequest(token: string, body: unknown) {
  return new Request("http://test.local/api/liff/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function meRequest(token: string, qs: string) {
  return new Request(`http://test.local/api/liff/me${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("POST /api/liff/register（第一次來）", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: KEY } });
  });

  it("建立學生並綁定這個 LINE，用 LINE 頭像、下一個學號、寫 Event", async () => {
    await createStudent(classroomId, { name: "既有" });
    const res = await register(registerRequest("lineMei", { key: KEY, name: "  Mei  " }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ name: "Mei", created: true });

    const student = await prisma.student.findUniqueOrThrow({ where: { id: body.id } });
    expect(student).toMatchObject({
      classroomId,
      lineUserId: "lineMei",
      lineDisplayName: "LINE-lineMei",
      avatarUrl: "https://profile.line-scdn.net/lineMei",
    });
    const numbers = (await prisma.student.findMany({ where: { classroomId } })).map((s) => s.number).sort();
    expect(new Set(numbers).size).toBe(2);
    expect(await prisma.event.count({ where: { studentId: student.id, title: "自助登記" } })).toBe(1);
    const account = await prisma.lineAccount.findUniqueOrThrow({ where: { lineUserId: "lineMei" } });
    expect(account).toMatchObject({ menuMode: "STUDENT", selectedStudentId: student.id });
  });

  it("冪等：同一個 LINE 再登記一次回同一位，不會多建、也不跳學號", async () => {
    const first = await (await register(registerRequest("lineMei", { key: KEY, name: "Mei" }))).json();
    const before = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } });
    const second = await (await register(registerRequest("lineMei", { key: KEY, name: "別的名字" }))).json();
    expect(second).toMatchObject({ id: first.id, created: false });
    expect(await prisma.student.count({ where: { classroomId } })).toBe(1);
    const after = await prisma.classroom.findUniqueOrThrow({ where: { id: classroomId } });
    expect(after.nextStudentNumber).toBe(before.nextStudentNumber);
  });

  it("並發登記兩次 → 只建一位", async () => {
    const [a, b] = await Promise.all([
      register(registerRequest("lineMei", { key: KEY, name: "Mei" })),
      register(registerRequest("lineMei", { key: KEY, name: "Mei" })),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await prisma.student.count({ where: { classroomId } })).toBe(1);
  });

  it("同名不擋（交給「可能重複」）", async () => {
    await createStudent(classroomId, { name: "Mei" });
    const res = await register(registerRequest("lineMei", { key: KEY, name: "Mei" }));
    expect(res.status).toBe(200);
    expect(await prisma.student.count({ where: { classroomId, name: "Mei" } })).toBe(2);
  });

  it("無效 key → 404；空名字 → 400；無效 token → 401", async () => {
    expect((await register(registerRequest("lineMei", { key: "nope", name: "Mei" }))).status).toBe(404);
    expect((await register(registerRequest("lineMei", { key: KEY, name: "  " }))).status).toBe(400);
    expect((await register(registerRequest("bad", { key: KEY, name: "Mei" }))).status).toBe(401);
    expect(await prisma.student.count()).toBe(0);
  });

  it("LINE 已綁別間教室的學生 → 在這間照樣可以登記一位新的", async () => {
    const other = await prisma.classroom.create({ data: { ownerId: 1, name: "別間" } });
    const elsewhere = await createStudent(other.id, { name: "Mei" });
    await prisma.student.update({ where: { id: elsewhere.id }, data: { lineUserId: "lineMei" } });

    const body = await (await register(registerRequest("lineMei", { key: KEY, name: "Mei" }))).json();
    expect(body.created).toBe(true);
    expect(body.id).not.toBe(elsewhere.id);
  });
});

describe("GET /api/liff/me?key=", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom({ name: "Salsa 教室" })).id;
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: KEY } });
  });

  it("這間教室沒有學生 → 403 not_bound，附教室名與 LINE 名稱頭像", async () => {
    const res = await me(meRequest("lineMei", `?key=${KEY}`));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: "not_bound",
      classroomName: "Salsa 教室",
      lineName: "LINE-lineMei",
      linePicture: "https://profile.line-scdn.net/lineMei",
    });
  });

  it("只看這間教室：綁了兩間的學生，帶 key 就直接是這間那位", async () => {
    const other = await prisma.classroom.create({ data: { ownerId: 1, name: "別間" } });
    const there = await createStudent(other.id, { name: "那邊" });
    const here = await createStudent(classroomId, { name: "這邊" });
    await prisma.student.updateMany({
      where: { id: { in: [there.id, here.id] } },
      data: { lineUserId: "lineMei" },
    });

    const res = await me(meRequest("lineMei", `?key=${KEY}`));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(here.id);

    // 記住的是別間的學生 → 403（gate 會清掉重試）
    const stale = await me(meRequest("lineMei", `?key=${KEY}&studentId=${there.id}`));
    expect(stale.status).toBe(403);
  });

  it("無效 key → 404", async () => {
    expect((await me(meRequest("lineMei", "?key=nope"))).status).toBe(404);
  });
});
