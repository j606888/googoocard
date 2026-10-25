import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createLesson,
  createPendingAttendance,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
vi.mock("@/lib/line", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/line")>()),
  bindDeepLink: (key: string) => `https://line.me/R/oaMessage/@oa/?${key}`,
}));

import { GET as LIST } from "@/app/api/students/line-invites/route";
import { POST as MARK_SENT } from "@/app/api/students/[id]/line-invite/route";

describe("未綁定 LINE 的學員", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("只列本教室、未封存、未綁定的學生，依最近出席排序，附邀請訊息", async () => {
    const bound = await createStudent(classroomId, { name: "已綁" });
    await prisma.student.update({ where: { id: bound.id }, data: { lineUserId: "U1" } });
    const archived = await createStudent(classroomId, { name: "封存" });
    await prisma.student.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    const never = await createStudent(classroomId, { name: "沒來過" });
    const recent = await createStudent(classroomId, { name: "最近來" });
    const { period } = await createLesson(classroomId, { withPeriod: true });
    await createPendingAttendance(period!.id, recent.id);

    const other = await prisma.classroom.create({ data: { ownerId: 1, name: "別間" } });
    await createStudent(other.id, { name: "別間的人" });

    const res = await LIST(jsonRequest("GET"), routeParams({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.boundCount).toBe(1);
    expect(body.totalCount).toBe(3);
    expect(body.students.map((s: { id: number }) => s.id)).toEqual([recent.id, never.id]);
    expect(body.students[0].inviteMessage).toContain("最近來");
    expect(body.students[0].inviteMessage).toContain("https://line.me/R/oaMessage/@oa/?");
    // Bind key is never exposed directly
    expect(body.students[0]).not.toHaveProperty("lineBindKey");
  });

  it("記錄已邀請時間；已綁定 → 400；別間教室 → 404", async () => {
    const student = await createStudent(classroomId);
    const res = await MARK_SENT(jsonRequest("POST"), routeParams({ id: String(student.id) }));
    expect(res.status).toBe(200);
    const updated = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated.lineInviteSentAt).not.toBeNull();

    await prisma.student.update({ where: { id: student.id }, data: { lineUserId: "U9" } });
    const again = await MARK_SENT(jsonRequest("POST"), routeParams({ id: String(student.id) }));
    expect(again.status).toBe(400);

    const other = await prisma.classroom.create({ data: { ownerId: 1, name: "別間" } });
    const outsider = await createStudent(other.id);
    const cross = await MARK_SENT(jsonRequest("POST"), routeParams({ id: String(outsider.id) }));
    expect(cross.status).toBe(404);
  });
});
