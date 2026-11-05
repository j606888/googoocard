import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLocation,
  createLesson,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/finance/receivers/route";
import { setupChecklist } from "@/service/finance/setup";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 11/1 台北

describe("opening: money received by non-custodians", () => {
  let classroomId: number;
  let ownerId: number;
  let noraId: number;
  let seanId: number;
  let studentId: number;
  let cardId: number;

  const receiversItem = async () => (await setupChecklist(classroomId)).find((i) => i.key === "receivers")!;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    ownerId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = ownerId;
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: ownerId });
    await prisma.membership.updateMany({ where: { userId: ownerId, classroomId }, data: { isCustodian: true, canSettle: true } });
    noraId = (await createMember(classroomId, { name: "Nora", email: "nora@test.local" })).id;
    seanId = (await createMember(classroomId, { name: "Sean", email: "sean@test.local" })).id;
    await prisma.membership.updateMany({ where: { userId: seanId, classroomId }, data: { isCustodian: true } });
    studentId = (await createStudent(classroomId)).id;
    cardId = (await createCard(classroomId)).id;
  });

  async function paidCard(paidByUserId: number | null, createdAt: Date, extra: { isPaid?: boolean } = {}) {
    const sc = await createStudentCard(studentId, cardId, { createdAt, finalPrice: 2000, ...extra });
    if (paidByUserId !== null) await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId } });
    return sc;
  }

  async function dropIn(paidByUserId: number, isPaid = true) {
    const { period } = await createLesson(classroomId, { withPeriod: true });
    const rec = await prisma.attendanceRecord.create({ data: { lessonPeriodId: period!.id, studentId } });
    return prisma.dropInCharge.create({
      data: { attendanceRecordId: rec.id, amount: 400, isPaid, paidByUserId, paidAt: new Date("2026-11-03T04:00:00Z") },
    });
  }

  it("lists only paid post-launch cards / drop-ins whose receiver is not a custodian", async () => {
    const after = new Date("2026-11-02T04:00:00Z");
    const stray = await paidCard(noraId, after);
    await paidCard(ownerId, after); // custodian
    await paidCard(seanId, after); // custodian
    await paidCard(noraId, new Date("2026-10-01T00:00:00Z")); // before launch
    await paidCard(noraId, after, { isPaid: false }); // unpaid: no money yet
    await paidCard(null, after); // no receiver
    const d = await dropIn(noraId);
    await dropIn(noraId, false);

    const res = await GET(jsonRequest("GET"), routeParams({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((i: { kind: string; id: number }) => `${i.kind}:${i.id}`).sort()).toEqual(
      [`card:${stray.id}`, `dropIn:${d.id}`].sort(),
    );
    const card = body.items.find((i: { kind: string }) => i.kind === "card");
    expect(card).toMatchObject({ amount: 2000, receiverUserId: noraId, receiverName: "Nora" });

    const item = await receiversItem();
    expect(item.done).toBe(false);
    expect(item.detail).toBe("2 筆、$2,400 記在不是保管人的人名下");
  });

  it("checklist item sits before legacyPrepaid and is done when nothing is stray", async () => {
    const keys = (await setupChecklist(classroomId)).map((i) => i.key);
    expect(keys.indexOf("receivers")).toBe(keys.indexOf("legacyPrepaid") - 1);
    expect((await receiversItem()).done).toBe(true);
  });

  it("reassigns the chosen rows to a custodian and sets the sold branch when missing", async () => {
    const loc = await createLocation(classroomId, { name: "高雄" });
    await prisma.location.update({ where: { id: loc.id }, data: { keeperUserId: seanId } });
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const b = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const d = await dropIn(noraId);

    const res = await POST(
      jsonRequest("POST", { toUserId: seanId, cardIds: [a.id], dropInIds: [d.id] }),
      routeParams({}),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cards: 1, dropIns: 1 });

    const aa = await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } });
    expect(aa.paidByUserId).toBe(seanId);
    expect(aa.soldLocationId).toBe(loc.id);
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: b.id } })).paidByUserId).toBe(noraId);
    expect((await prisma.dropInCharge.findUniqueOrThrow({ where: { id: d.id } })).paidByUserId).toBe(seanId);
    expect((await receiversItem()).done).toBe(false);

    await POST(jsonRequest("POST", { toUserId: ownerId, cardIds: [b.id], dropInIds: [] }), routeParams({}));
    expect((await receiversItem()).done).toBe(true);
  });

  it("keeps an existing sold branch", async () => {
    const loc = await createLocation(classroomId, { name: "台南" });
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    await prisma.studentCard.update({ where: { id: a.id }, data: { soldLocationId: loc.id } });
    await POST(jsonRequest("POST", { toUserId: seanId, cardIds: [a.id], dropInIds: [] }), routeParams({}));
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: a.id } })).soldLocationId).toBe(loc.id);
  });

  it("target must be a custodian; caller must be able to settle; other classrooms untouched", async () => {
    const a = await paidCard(noraId, new Date("2026-11-02T04:00:00Z"));
    const bad = await POST(jsonRequest("POST", { toUserId: noraId, cardIds: [a.id], dropInIds: [] }), routeParams({}));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("NOT_FINANCE_MEMBER");

    // a custodian-only member cannot do it
    auth.userId = seanId;
    const forbidden = await POST(jsonRequest("POST", { toUserId: seanId, cardIds: [a.id], dropInIds: [] }), routeParams({}));
    expect(forbidden.status).toBe(403);
    auth.userId = ownerId;

    const other = await createClassroom({ name: "Other", email: "o2@test.local" });
    const os = await createStudent(other.id);
    const oc = await createCard(other.id);
    const otherCard = await createStudentCard(os.id, oc.id, { createdAt: new Date("2026-11-02T04:00:00Z") });
    await prisma.studentCard.update({ where: { id: otherCard.id }, data: { paidByUserId: other.ownerId } });
    const res = await POST(
      jsonRequest("POST", { toUserId: seanId, cardIds: [otherCard.id, a.id], dropInIds: [] }),
      routeParams({}),
    );
    expect(await res.json()).toEqual({ cards: 1, dropIns: 0 });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: otherCard.id } })).paidByUserId).toBe(other.ownerId);
  });
});
