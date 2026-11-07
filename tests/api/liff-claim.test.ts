import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  jsonRequest,
  routeParams,
} from "../factories";

// Token string IS the lineUserId; "bad" → invalid.
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad"
      ? { userId: token, name: `LINE-${token}`, picture: `https://profile.line-scdn.net/${token}` }
      : null,
}));
const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET as search, POST as claim } from "@/app/api/liff/claim/route";
import { DELETE as confirm } from "@/app/api/students/[id]/line-claim/route";
import { DELETE as unbind } from "@/app/api/students/[id]/line-binding/route";
import { getTodos } from "@/service/todos";

const KEY = "wallKey123";

const searchReq = (token: string, q: string, key = KEY) =>
  new Request(`http://test.local/api/liff/claim?key=${key}&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
const claimReq = (token: string, body: unknown) =>
  new Request("http://test.local/api/liff/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

describe("LIFF 自助認領（我來上過課）", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey: KEY } });
  });

  it("搜尋：要打字、只回未綁定在籍學生，帶剩餘堂數", async () => {
    const card = await createCard(classroomId);
    const mei = await createStudent(classroomId, { name: "Mei" });
    await createStudentCard(mei.id, card.id, { remainingSessions: 4 });
    const bound = await createStudent(classroomId, { name: "Meiko" });
    await prisma.student.update({ where: { id: bound.id }, data: { lineUserId: "Uother" } });
    const archived = await createStudent(classroomId, { name: "Meimei" });
    await prisma.student.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    const other = await createClassroom({ email: "other@test.local" });
    await createStudent(other.id, { name: "Mei 別班" });

    const empty = await (await search(searchReq("Unew", "  "))).json();
    expect(empty.students).toEqual([]);

    const res = await search(searchReq("Unew", "mei"));
    expect(res.status).toBe(200);
    const { students } = await res.json();
    expect(students).toEqual([{ id: mei.id, name: "Mei", avatarUrl: expect.any(String), remainingSessions: 4 }]);
  });

  it("搜尋與認領都要 LINE token 和有效的教室 key", async () => {
    expect((await search(searchReq("bad", "Mei"))).status).toBe(401);
    expect((await search(searchReq("Unew", "Mei", "nope"))).status).toBe(404);
    const mei = await createStudent(classroomId, { name: "Mei" });
    expect((await claim(claimReq("bad", { key: KEY, studentId: mei.id }))).status).toBe(401);
    expect((await claim(claimReq("Unew", { key: "nope", studentId: mei.id }))).status).toBe(404);
  });

  it("認領：綁定 LINE、標記待確認、寫動態、進待處理", async () => {
    const mei = await createStudent(classroomId, { name: "Mei" });
    const res = await claim(claimReq("Umei", { key: KEY, studentId: mei.id }));
    expect(res.status).toBe(200);

    const after = await prisma.student.findUniqueOrThrow({ where: { id: mei.id } });
    expect(after.lineUserId).toBe("Umei");
    expect(after.lineDisplayName).toBe("LINE-Umei");
    expect(after.lineSelfClaimedAt).not.toBeNull();
    const event = await prisma.event.findFirstOrThrow({ where: { studentId: mei.id, title: "綁定 LINE" } });
    expect(event.description).toContain("掃現場 QR 從名單認領");

    const todos = await getTodos(classroomId);
    expect(todos.lineSelfClaims).toEqual([
      expect.objectContaining({ student: expect.objectContaining({ id: mei.id }), lineDisplayName: "LINE-Umei" }),
    ]);
    expect(todos.reminderCount).toBe(1);
  });

  it("已綁定的人搶不走；同一個 LINE 在這間已有學生也不能再認領", async () => {
    const mei = await createStudent(classroomId, { name: "Mei" });
    const ken = await createStudent(classroomId, { name: "Ken" });
    expect((await claim(claimReq("Umei", { key: KEY, studentId: mei.id }))).status).toBe(200);
    expect((await claim(claimReq("Uthief", { key: KEY, studentId: mei.id }))).status).toBe(409);
    expect((await claim(claimReq("Umei", { key: KEY, studentId: ken.id }))).status).toBe(409);
    const after = await prisma.student.findUniqueOrThrow({ where: { id: mei.id } });
    expect(after.lineUserId).toBe("Umei");
  });

  it("別班或封存的學生不能認領", async () => {
    const other = await createClassroom({ email: "other@test.local" });
    const outsider = await createStudent(other.id, { name: "Out" });
    expect((await claim(claimReq("Unew", { key: KEY, studentId: outsider.id }))).status).toBe(404);
    const archived = await createStudent(classroomId, { name: "Gone" });
    await prisma.student.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    expect((await claim(claimReq("Unew", { key: KEY, studentId: archived.id }))).status).toBe(404);
  });

  it("老師按沒問題 → 清掉待確認、綁定保留", async () => {
    const mei = await createStudent(classroomId, { name: "Mei" });
    await claim(claimReq("Umei", { key: KEY, studentId: mei.id }));
    const res = await confirm(jsonRequest("DELETE"), routeParams({ id: String(mei.id) }));
    expect(res.status).toBe(200);
    const after = await prisma.student.findUniqueOrThrow({ where: { id: mei.id } });
    expect(after).toMatchObject({ lineUserId: "Umei", lineSelfClaimedAt: null });
    expect((await getTodos(classroomId)).lineSelfClaims).toEqual([]);
  });

  it("老師解除綁定 → 也清掉待確認；別班的老師動不了", async () => {
    const mei = await createStudent(classroomId, { name: "Mei" });
    await claim(claimReq("Umei", { key: KEY, studentId: mei.id }));

    const other = await createClassroom({ email: "other@test.local" });
    auth.classroomId = other.id;
    expect((await confirm(jsonRequest("DELETE"), routeParams({ id: String(mei.id) }))).status).toBe(404);
    auth.classroomId = classroomId;

    await unbind(jsonRequest("DELETE"), routeParams({ id: String(mei.id) }));
    const after = await prisma.student.findUniqueOrThrow({ where: { id: mei.id } });
    expect(after).toMatchObject({ lineUserId: null, lineSelfClaimedAt: null });
  });
});
