import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createLesson,
  createLocation,
  createStudentCard,
  jsonRequest,
  routeParams,
} from "../factories";

// finance-lite 的 API：權限（管理員＋分部負責人）、跨教室、基本流程。
const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0, role: "owner" }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
  readAuthSession: async () => auth,
}));

import { GET as getSettings } from "@/app/api/finance/settings/route";
import { PATCH as patchLocation } from "@/app/api/finance/locations/[id]/route";
import { GET as getLesson, PUT as putLessonRule } from "@/app/api/finance/lessons/[id]/route";
import { POST as settle, DELETE as unsettle } from "@/app/api/finance/periods/[periodId]/settle/route";
import { GET as getBalance } from "@/app/api/finance/balance/route";
import { POST as createTransfer } from "@/app/api/finance/transfers/route";
import { POST as createVenue } from "@/app/api/finance/venues/route";
import { DELETE as deleteVenue } from "@/app/api/finance/venues/[id]/route";
import { POST as createPack, GET as getPacks } from "@/app/api/finance/packs/route";
import { PATCH as patchCard } from "@/app/api/finance/student-cards/[id]/route";

describe("finance-lite routes", () => {
  let classroomId: number;
  let owner: number;
  let teacherUser: number;
  let T: number;
  let K: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    owner = c.ownerId;
    teacherUser = (await createMember(classroomId, { email: "t@test.local", role: "teacher" })).id;
    auth.classroomId = classroomId;
    auth.userId = owner;
    auth.role = "owner";
    T = (await createLocation(classroomId, { name: "台南" })).id;
    K = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
  });

  const asTeacher = () => {
    auth.userId = teacherUser;
    auth.role = "teacher";
  };

  it("只有管理員能設定分部負責人與轉換日；轉換日照台北時間", async () => {
    asTeacher();
    let res = await patchLocation(jsonRequest("PATCH", { keeperUserId: teacherUser }), routeParams({ id: String(T) }));
    expect(res.status).toBe(403);

    auth.userId = owner;
    auth.role = "owner";
    res = await patchLocation(
      jsonRequest("PATCH", { keeperUserId: owner, financeStartDate: "2026-12-01" }),
      routeParams({ id: String(T) })
    );
    expect(res.status).toBe(200);
    const loc = await res.json();
    expect(loc.keeperUserId).toBe(owner);
    expect(new Date(loc.financeStartAt).toISOString()).toBe("2026-11-30T16:00:00.000Z");

    const settings = await (await getSettings(jsonRequest("GET"), routeParams({}))).json();
    expect(settings).toMatchObject({ enabled: true, canManage: true, isAdmin: true });
  });

  it("負責人要是成員", async () => {
    const other = await createClassroom({ name: "x", email: "x@test.local" });
    const res = await patchLocation(jsonRequest("PATCH", { keeperUserId: other.ownerId }), routeParams({ id: String(T) }));
    expect(res.status).toBe(400);
  });

  it("老師（不是負責人）不能改規則、結清、記轉帳；成為負責人後可以", async () => {
    const { lesson } = await createLesson(classroomId, { locationId: T });
    asTeacher();
    const rule = { lines: [], rest: { type: "holder" } };
    expect((await putLessonRule(jsonRequest("PUT", { rule }), routeParams({ id: String(lesson.id) }))).status).toBe(403);
    expect(
      (await createTransfer(jsonRequest("POST", { fromLocationId: K, toLocationId: T, amount: 100 }), routeParams({}))).status
    ).toBe(403);

    await prisma.location.update({ where: { id: T }, data: { keeperUserId: teacherUser } });
    expect((await putLessonRule(jsonRequest("PUT", { rule }), routeParams({ id: String(lesson.id) }))).status).toBe(200);
  });

  it("別的教室的課 404", async () => {
    const other = await createClassroom({ name: "x", email: "x@test.local" });
    const { lesson } = await createLesson(other.id);
    expect((await getLesson(jsonRequest("GET"), routeParams({ id: String(lesson.id) }))).status).toBe(404);
  });

  it("流程：設負責人與轉換日 → 規則 → 結清 → 往來 → 轉帳 → 取消結清", async () => {
    const sean = (await createMember(classroomId, { email: "s@test.local", name: "Sean", role: "admin" })).id;
    await patchLocation(jsonRequest("PATCH", { keeperUserId: owner, financeStartDate: "2026-05-01" }), routeParams({ id: String(T) }));
    await patchLocation(jsonRequest("PATCH", { keeperUserId: sean, financeStartDate: "2026-05-01" }), routeParams({ id: String(K) }));
    const teacher = await prisma.teacher.create({ data: { classroomId, name: "外師", kind: "TEACHER" } });

    const card = await createCard(classroomId);
    const { lesson, period } = await createLesson(classroomId, { locationId: T, withPeriod: true });
    await prisma.lessonPeriod.update({ where: { id: period!.id }, data: { attendanceTakenAt: new Date() } });
    const s = await createStudent(classroomId);
    const sc = await createStudentCard(s.id, card.id, { finalPrice: 3000, totalSessions: 6 });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId: s.id, studentCardId: sc.id } });
    // 舊卡：錢在高雄
    const res0 = await patchCard(jsonRequest("PATCH", { moneyLocationId: K, homeLocationId: T }), routeParams({ id: String(sc.id) }));
    expect(res0.status).toBe(200);

    const rule = {
      lines: [{ kind: "fixed", amount: 300, to: { type: "teacher", teacherId: teacher.id } }],
      rest: { type: "holder" },
    };
    expect((await putLessonRule(jsonRequest("PUT", { rule }), routeParams({ id: String(lesson.id) }))).status).toBe(200);

    const lessonFinance = await (await getLesson(jsonRequest("GET"), routeParams({ id: String(lesson.id) }))).json();
    expect(lessonFinance.periods[0]).toMatchObject({ income: 500, counted: true, settlement: null });

    const settled = await settle(jsonRequest("POST", {}), routeParams({ periodId: String(period!.id) }));
    expect(settled.status).toBe(200);
    let bal = await (await getBalance(jsonRequest("GET"), routeParams({}))).json();
    expect(bal.pairs).toEqual([{ from: K, to: T, amount: 300 }]);
    expect(bal.unsettled).toEqual([]);

    await createTransfer(jsonRequest("POST", { fromLocationId: K, toLocationId: T, amount: 300 }), routeParams({}));
    bal = await (await getBalance(jsonRequest("GET"), routeParams({}))).json();
    expect(bal.pairs).toEqual([]);

    await unsettle(jsonRequest("DELETE"), routeParams({ periodId: String(period!.id) }));
    bal = await (await getBalance(jsonRequest("GET"), routeParams({}))).json();
    expect(bal.pairs).toEqual([{ from: T, to: K, amount: 300 }]);
    expect(bal.unsettled).toHaveLength(1);
  });

  it("場地：次數包只給買包的場地，有包就不能刪", async () => {
    const res = await createVenue(jsonRequest("POST", { name: "高雄教室", locationId: K }), routeParams({}));
    const venue = await res.json();
    const perSession = await (
      await createVenue(jsonRequest("POST", { name: "台南教室", locationId: T, perSessionPrice: 300 }), routeParams({}))
    ).json();
    expect((await createPack(jsonRequest("POST", { venueId: perSession.id, sessions: 10, price: 3000 }), routeParams({}))).status).toBe(400);
    expect((await createPack(jsonRequest("POST", { venueId: venue.id, sessions: 10, price: 4000 }), routeParams({}))).status).toBe(200);
    const { packs } = await (await getPacks(jsonRequest("GET"), routeParams({}))).json();
    expect(packs[0]).toMatchObject({ sessions: 10, used: 0 });
    expect((await deleteVenue(jsonRequest("DELETE"), routeParams({ id: String(venue.id) }))).status).toBe(409);
    expect((await deleteVenue(jsonRequest("DELETE"), routeParams({ id: String(perSession.id) }))).status).toBe(200);
  });
});
