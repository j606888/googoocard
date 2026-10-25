import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  createDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET as PREVIEW } from "@/app/api/students/[id]/merge-preview/route";
import { POST as MERGE } from "@/app/api/students/[id]/merge/route";

const merge = (sourceId: number, body: Record<string, unknown>) =>
  MERGE(jsonRequest("POST", body), routeParams({ id: String(sourceId) }));
const preview = async (sourceId: number, targetId: number) =>
  PREVIEW(
    new Request(`http://test.local/api/students/${sourceId}/merge-preview?targetId=${targetId}`),
    routeParams({ id: String(sourceId) })
  );

describe("合併學員", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("課卡、出席、動態搬到保留的學員；來源封存並記 mergedIntoId；LINE 移過去", async () => {
    const card = await createCard(classroomId);
    const target = await createStudent(classroomId, { name: "雅婷" });
    const source = await createStudent(classroomId, { name: "雅婷" });
    await prisma.student.update({ where: { id: source.id }, data: { lineUserId: "U-new" } });
    const sc = await createStudentCard(source.id, card.id, { remainingSessions: 0, totalSessions: 1 });
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true, cardIds: [card.id] });
    await prisma.lessonStudent.create({ data: { lessonId: lesson.id, studentId: source.id } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: source.id, studentCardId: sc.id },
    });
    await prisma.event.create({
      data: { title: "簽到", description: "x", studentId: source.id, resourceType: "x", resourceId: 1 },
    });
    await prisma.lineAccount.create({ data: { lineUserId: "U-new", selectedStudentId: source.id } });

    const res = await merge(source.id, { targetId: target.id });
    expect(res.status).toBe(200);

    expect(await prisma.studentCard.count({ where: { studentId: target.id } })).toBe(1);
    expect(await prisma.attendanceRecord.count({ where: { studentId: target.id } })).toBe(1);
    expect(await prisma.lessonStudent.count({ where: { studentId: target.id } })).toBe(1);
    expect(await prisma.event.count({ where: { studentId: target.id, title: "簽到" } })).toBe(1);
    expect(await prisma.event.count({ where: { studentId: target.id, title: "合併學員" } })).toBe(1);

    const s = await prisma.student.findUniqueOrThrow({ where: { id: source.id } });
    expect(s.archivedAt).not.toBeNull();
    expect(s.mergedIntoId).toBe(target.id);
    expect(s.lineUserId).toBeNull();
    const t = await prisma.student.findUniqueOrThrow({ where: { id: target.id } });
    expect(t.lineUserId).toBe("U-new");
    const account = await prisma.lineAccount.findUniqueOrThrow({ where: { lineUserId: "U-new" } });
    expect(account.selectedStudentId).toBe(target.id);
  });

  it("同一堂兩邊都點名：保留有綁卡的那筆，另一筆刪掉並退回它扣的堂", async () => {
    const card = await createCard(classroomId);
    const target = await createStudent(classroomId, { name: "A" });
    const source = await createStudent(classroomId, { name: "A" });
    const sourceCard = await createStudentCard(source.id, card.id, { remainingSessions: 4, totalSessions: 5 });
    const { period } = await createLesson(classroomId, { withPeriod: true, cardIds: [card.id] });
    // target 沒綁卡、source 有綁卡 → 保留 source 那筆
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId: target.id } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period!.id, studentId: source.id, studentCardId: sourceCard.id },
    });

    const pre = await (await preview(source.id, target.id)).json();
    expect(pre.clashes).toHaveLength(1);
    expect(pre.clashes[0]).toMatchObject({ keepFrom: "source", refundCardName: null });

    await merge(source.id, { targetId: target.id });
    const records = await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: period!.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ studentId: target.id, studentCardId: sourceCard.id });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sourceCard.id } })).remainingSessions).toBe(4);
  });

  it("兩邊都有綁卡：保留 target 的，source 那張退一堂", async () => {
    const card = await createCard(classroomId);
    const target = await createStudent(classroomId, { name: "A" });
    const source = await createStudent(classroomId, { name: "A" });
    const tc = await createStudentCard(target.id, card.id, { remainingSessions: 3 });
    const sc = await createStudentCard(source.id, card.id, { remainingSessions: 3 });
    const { period } = await createLesson(classroomId, { withPeriod: true, cardIds: [card.id] });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId: target.id, studentCardId: tc.id } });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId: source.id, studentCardId: sc.id } });

    await merge(source.id, { targetId: target.id });
    const records = await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: period!.id } });
    expect(records).toEqual([expect.objectContaining({ studentCardId: tc.id })]);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } })).remainingSessions).toBe(4);
  });

  it("舞種資格取高、tag 去重", async () => {
    const style = await createDanceStyle(classroomId, { name: "Salsa" });
    const target = await createStudent(classroomId, { name: "A", levels: { [style.id]: 1 } });
    const source = await createStudent(classroomId, { name: "A", levels: { [style.id]: 2 } });
    const tag = await prisma.tag.create({ data: { name: "VIP", classroomId } });
    await prisma.studentTag.createMany({
      data: [
        { studentId: target.id, tagId: tag.id },
        { studentId: source.id, tagId: tag.id },
      ],
    });

    await merge(source.id, { targetId: target.id });
    const quals = await prisma.studentDanceQualification.findMany({ where: { studentId: target.id } });
    expect(quals).toEqual([expect.objectContaining({ danceStyleId: style.id, level: 2 })]);
    expect(await prisma.studentTag.count({ where: { studentId: target.id, tagId: tag.id } })).toBe(1);
  });

  it("兩邊綁了不同 LINE：沒指定 → 400；指定 source → 用 source 的", async () => {
    const target = await createStudent(classroomId, { name: "A" });
    const source = await createStudent(classroomId, { name: "A" });
    await prisma.student.update({ where: { id: target.id }, data: { lineUserId: "U-old" } });
    await prisma.student.update({ where: { id: source.id }, data: { lineUserId: "U-new" } });

    expect((await (await preview(source.id, target.id)).json()).lineConflict).toBe(true);
    const bad = await merge(source.id, { targetId: target.id });
    expect(bad.status).toBe(400);
    expect((await prisma.student.findUniqueOrThrow({ where: { id: source.id } })).archivedAt).toBeNull();

    await merge(source.id, { targetId: target.id, keepLineFrom: "source" });
    expect((await prisma.student.findUniqueOrThrow({ where: { id: target.id } })).lineUserId).toBe("U-new");
  });

  it("別間教室的學生 → 404；自己併自己 → 400", async () => {
    const mine = await createStudent(classroomId);
    const other = await prisma.classroom.create({ data: { ownerId: 1, name: "別間" } });
    const theirs = await createStudent(other.id);
    expect((await merge(mine.id, { targetId: theirs.id })).status).toBe(404);
    expect((await merge(theirs.id, { targetId: mine.id })).status).toBe(404);
    expect((await merge(mine.id, { targetId: mine.id })).status).toBe(400);
  });
});
