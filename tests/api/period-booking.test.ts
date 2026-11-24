import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, createCard, createLesson, createStudentCard, routeParams } from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as getRoster, POST as postBookings } from "@/app/api/lessons/[id]/bookings/route";
import { GET as getPeriodBookings, POST as postPeriodBooking } from "@/app/api/lessons/[id]/periods/[periodId]/bookings/route";
import { takeAttendance } from "@/domains/attendance/attendance.service";
import { previewPeriodCards } from "@/service/attendancePreview";
import { getTodayLessons } from "@/service/checkin";
import { todayClaimSuggestions } from "@/service/claimSuggestions";
import { mergeStudents } from "@/service/studentMerge";
import { getTodos } from "@/service/todos";

const json = (method: string, url: string, body?: unknown) =>
  new Request(`http://test.local${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const DAY = 24 * 60 * 60 * 1000;

// 預計會來：跟付費、點名都分開——只是提示，不預設勾選、不扣卡、不進名單。
describe("預計會來（PeriodBooking）", () => {
  let classroomId: number;
  let lessonId: number;
  let cardId: number;
  let periodIds: number[];

  const setBookings = async (body: unknown) =>
    postBookings(json("POST", `/api/lessons/${lessonId}/bookings`, body), routeParams({ id: String(lessonId) }));
  const roster = async () =>
    (await getRoster(json("GET", "/x"), routeParams({ id: String(lessonId) }))).json();

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    cardId = (await createCard(classroomId, { name: "進階 6 堂", price: 2400, sessions: 6 })).id;
    lessonId = (await createLesson(classroomId, { cardIds: [cardId] })).lesson.id;
    const start = new Date("2026-12-01T11:30:00Z");
    periodIds = [];
    for (let i = 0; i < 3; i++) {
      const p = await prisma.lessonPeriod.create({
        data: { lessonId, startTime: new Date(start.getTime() + i * 7 * DAY), endTime: new Date(start.getTime() + i * 7 * DAY + 3600_000) },
      });
      periodIds.push(p.id);
    }
  });

  it("登記新學員會來哪幾堂；可以改、可以取消還沒上的；不進正式名單", async () => {
    const res = await setBookings({ newStudentName: "新同學", periodIds: [periodIds[0], periodIds[2]], note: "先試第一堂" });
    expect(res.status).toBe(200);
    const { studentId } = await res.json();
    expect(await prisma.student.findUniqueOrThrow({ where: { id: studentId } })).toMatchObject({ name: "新同學" });

    let data = await roster();
    expect(data.students).toHaveLength(1);
    expect(data.students[0]).toMatchObject({ note: "先試第一堂", statuses: ["booked", null, "booked"] });
    // 預約不是名單，也不是待處理。
    expect(await prisma.lessonStudent.count({ where: { lessonId, studentId } })).toBe(0);
    expect((await getTodos(classroomId)).unboundAttendance).toEqual([]);

    await setBookings({ studentId, periodIds: [periodIds[1]], note: "改第二堂" });
    data = await roster();
    expect(data.students[0]).toMatchObject({ note: "改第二堂", statuses: [null, "booked", null] });

    await setBookings({ studentId, periodIds: [] });
    expect((await roster()).students).toEqual([]);
  });

  it("點過名的堂不能預約", async () => {
    await takeAttendance({ lessonId, lessonPeriodId: periodIds[0], studentIds: [] });
    const s = await createStudent(classroomId, { name: "晚來" });
    const res = await setBookings({ studentId: s.id, periodIds: [periodIds[0]] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PERIOD_NOT_OPEN");
    const single = await postPeriodBooking(
      json("POST", "/x", { studentId: s.id }),
      routeParams({ id: String(lessonId), periodId: String(periodIds[0]) })
    );
    expect(single.status).toBe(400);
  });

  it("點名不會自動算預約的人；點完看得出有來／預約沒來／沒預約但來了", async () => {
    const came = await createStudent(classroomId, { name: "有來" });
    const noShow = await createStudent(classroomId, { name: "放鳥" });
    const walkIn = await createStudent(classroomId, { name: "臨時來" });
    for (const s of [came, noShow]) await setBookings({ studentId: s.id, periodIds: [periodIds[0]] });

    await takeAttendance({ lessonId, lessonPeriodId: periodIds[0], studentIds: [came.id, walkIn.id] });
    const records = await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: periodIds[0] } });
    expect(records.map((r) => r.studentId).sort()).toEqual([came.id, walkIn.id].sort());

    const data = await roster();
    const statusOf = (id: number) =>
      data.students.find((e: { student: { id: number } }) => e.student.id === id)?.statuses[0];
    expect(statusOf(came.id)).toBe("present");
    expect(statusOf(noShow.id)).toBe("no_show");
    expect(data.students.find((e: { student: { id: number } }) => e.student.id === noShow.id).counts.noShow).toBe(1);
    // 沒預約的人不在預計會來名單上。
    expect(statusOf(walkIn.id)).toBeUndefined();
  });

  it("點名頁「＋ 預計會來」只登記這一堂；預覽先算好會扣哪張卡", async () => {
    const s = await createStudent(classroomId, { name: "有卡" });
    await createStudentCard(s.id, cardId, { remainingSessions: 6 });
    const res = await postPeriodBooking(
      json("POST", "/x", { studentId: s.id, note: "說會帶朋友" }),
      routeParams({ id: String(lessonId), periodId: String(periodIds[1]) })
    );
    expect(res.status).toBe(200);
    const list = await (
      await getPeriodBookings(json("GET", "/x"), routeParams({ id: String(lessonId), periodId: String(periodIds[1]) }))
    ).json();
    expect(list.bookings).toEqual([{ note: "說會帶朋友", student: expect.objectContaining({ id: s.id }) }]);

    const preview = await previewPeriodCards({ lessonId, periodId: periodIds[1], classroomId, extraStudentIds: [] });
    expect(preview?.[s.id]).toMatchObject({ kind: "auto" });
  });

  it("LIFF：預約的課標 booked、排最前面；「這是你嗎」列出今天預約、還沒綁 LINE 的人", async () => {
    const other = (await createLesson(classroomId, { name: "先建的課" })).lesson;
    const now = Date.now();
    const mk = (lid: number) =>
      prisma.lessonPeriod.create({ data: { lessonId: lid, startTime: new Date(now + 3600_000), endTime: new Date(now + 7200_000) } });
    await mk(other.id);
    const todayPeriod = await mk(lessonId);
    const s = await createStudent(classroomId, { name: "王小明" });
    await setBookings({ studentId: s.id, periodIds: [todayPeriod.id] });

    const today = await getTodayLessons(classroomId, s.id);
    expect(today.today[0].lessonId).toBe(lessonId);
    expect(today.today[0].periods[0]).toMatchObject({ periodId: todayPeriod.id, booked: true });
    expect(today.today[1].periods[0].booked).toBeUndefined();

    const suggestions = await todayClaimSuggestions(classroomId, "小明");
    const group = suggestions.groups.find((g) => g.lessonId === lessonId);
    expect(group?.students).toEqual([expect.objectContaining({ id: s.id, kind: "booked" })]);
    expect(suggestions.bestMatchId).toBe(s.id);
  });

  it("合併學員：預約搬到保留的那位，同一堂兩邊都有就留一筆", async () => {
    const target = await createStudent(classroomId, { name: "本人" });
    const source = await createStudent(classroomId, { name: "本人2" });
    await setBookings({ studentId: target.id, periodIds: [periodIds[0]] });
    await setBookings({ studentId: source.id, periodIds: [periodIds[0], periodIds[1]] });
    await mergeStudents(classroomId, source.id, target.id);
    const rows = await prisma.periodBooking.findMany({ orderBy: { lessonPeriodId: "asc" } });
    expect(rows.map((r) => [r.studentId, r.lessonPeriodId])).toEqual([
      [target.id, periodIds[0]],
      [target.id, periodIds[1]],
    ]);
  });
});
