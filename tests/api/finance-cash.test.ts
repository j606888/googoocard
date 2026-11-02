import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createLocation,
  createStudent,
  createCard,
  createStudentCard,
  createTeacher,
  createVenue,
  enableFinanceFor,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as GET_EXPENSES, POST as POST_EXPENSE } from "@/app/api/finance/expenses/route";
import { DELETE as DELETE_EXPENSE } from "@/app/api/finance/expenses/[id]/route";
import { GET as GET_TRANSFERS, POST as POST_TRANSFER } from "@/app/api/finance/transfers/route";
import { DELETE as DELETE_TRANSFER } from "@/app/api/finance/transfers/[id]/route";
import { POST as POST_REFUND } from "@/app/api/finance/refunds/route";

describe("finance cash APIs", () => {
  let classroomId: number;
  let locationId: number;
  let nonFinanceId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
    auth.userId = 1;
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId: 1 });
    await prisma.membership.updateMany({ where: { userId: 1, classroomId }, data: { isFinance: true } });
    nonFinanceId = (await createMember(classroomId)).id;
    locationId = (await createLocation(classroomId)).id;
  });

  const expense = (extra = {}) =>
    POST_EXPENSE(
      jsonRequest("POST", { date: "2026-11-02", amount: 300, locationId, category: "水電", paidByUserId: 1, ...extra }),
      routeParams({})
    );

  it("expense requires finance", async () => {
    auth.userId = nonFinanceId;
    expect((await expense()).status).toBe(403);
    auth.userId = 1;
    expect((await expense()).status).toBe(200);
    expect((await expense({ paidByUserId: nonFinanceId })).status).toBe(400);
    expect((await expense({ date: "2026-02-31" })).status).toBe(400);
    expect((await expense({ category: "x".repeat(21) })).status).toBe(400);
    expect((await expense({ amount: 0 })).status).toBe(400);
    const other = await createClassroom({ name: "O", email: "o@test.local" });
    const otherLoc = await createLocation(other.id);
    expect((await expense({ locationId: otherLoc.id })).status).toBe(404);
  });

  it("transfer SELF sets toUserId; targets are validated", async () => {
    const post = async (b: object) =>
      POST_TRANSFER(jsonRequest("POST", { date: "2026-11-02", amount: 100, fromUserId: 1, ...b }), routeParams({}));
    const res = await post({ toKind: "SELF", toUserId: nonFinanceId });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ toKind: "SELF", toUserId: 1 });

    expect((await post({ toKind: "USER" })).status).toBe(400);
    expect((await post({ toKind: "USER", toUserId: nonFinanceId })).status).toBe(400);
    expect((await post({ toKind: "USER", toUserId: 1 })).status).toBe(200);

    const teacher = await createTeacher(classroomId);
    expect((await post({ toKind: "TEACHER", toTeacherId: teacher.id })).status).toBe(200);
    expect((await post({ toKind: "TEACHER" })).status).toBe(400);
    const venue = await createVenue(classroomId);
    expect((await post({ toKind: "VENUE", toVenueId: venue.id })).status).toBe(200);

    const other = await createClassroom({ name: "O", email: "o@test.local" });
    const ot = await createTeacher(other.id);
    const ov = await createVenue(other.id);
    expect((await post({ toKind: "TEACHER", toTeacherId: ot.id })).status).toBe(404);
    expect((await post({ toKind: "VENUE", toVenueId: ov.id })).status).toBe(404);
  });

  it("void hides from GET", async () => {
    const e = await (await expense()).json();
    const t = await (
      await POST_TRANSFER(
        jsonRequest("POST", { date: "2026-11-02", amount: 100, fromUserId: 1, toKind: "SELF" }),
        routeParams({})
      )
    ).json();
    expect((await (await GET_EXPENSES(jsonRequest("GET"), routeParams({}))).json()).expenses).toHaveLength(1);
    expect((await DELETE_EXPENSE(jsonRequest("DELETE"), routeParams({ id: String(e.id) }))).status).toBe(200);
    expect((await DELETE_TRANSFER(jsonRequest("DELETE"), routeParams({ id: String(t.id) }))).status).toBe(200);
    expect((await (await GET_EXPENSES(jsonRequest("GET"), routeParams({}))).json()).expenses).toHaveLength(0);
    expect((await (await GET_TRANSFERS(jsonRequest("GET"), routeParams({}))).json()).transfers).toHaveLength(0);
    expect(await prisma.financeExpense.count()).toBe(1);
  });

  it("GET filters by month", async () => {
    await expense({ date: "2026-10-31" });
    await expense({ date: "2026-11-01" });
    const res = await GET_EXPENSES(
      new Request("http://localhost/api/finance/expenses?month=2026-11"),
      routeParams({})
    );
    expect((await res.json()).expenses).toHaveLength(1);
  });

  describe("refunds", () => {
    let studentId: number;
    const refund = (studentCardId: number, extra = {}) =>
      POST_REFUND(
        jsonRequest("POST", { studentCardId, amount: 500, paidByUserId: 1, date: "2026-11-02", ...extra }),
        routeParams({})
      );
    const mkCard = async (opts = {}) => {
      const card = await createCard(classroomId);
      return createStudentCard(studentId, card.id, { finalPrice: 2000, totalSessions: 6, remainingSessions: 2, ...opts });
    };

    beforeEach(async () => {
      studentId = (await createStudent(classroomId)).id;
    });

    it("refund closes card and records refund", async () => {
      const sc = await mkCard();
      const res = await refund(sc.id);
      expect(res.status).toBe(200);
      const after = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
      expect(after.closedReason).toBe("REFUNDED");
      expect(after.expiredAt?.toISOString()).toBe("2026-11-01T16:00:00.000Z");
      expect(await prisma.financeRefund.count({ where: { studentCardId: sc.id, amount: 500 } })).toBe(1);
      // double refund
      expect((await refund(sc.id)).status).toBe(400);
    });

    it("refund cannot exceed remaining value", async () => {
      const sc = await mkCard();
      const bad = await refund(sc.id, { amount: 667 });
      expect(bad.status).toBe(400);
      expect((await bad.json()).code).toBe("REFUND_EXCEEDS_VALUE");
      expect((await refund(sc.id, { amount: 666 })).status).toBe(200);
    });

    it("rejects unpaid, other-classroom and non-finance payer", async () => {
      const unpaid = await mkCard({ isPaid: false });
      const r = await refund(unpaid.id);
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("CARD_NOT_PAID");

      const sc = await mkCard();
      expect((await refund(sc.id, { paidByUserId: nonFinanceId })).status).toBe(400);

      const other = await createClassroom({ name: "O", email: "o@test.local" });
      const os = await createStudent(other.id);
      const oc = await createCard(other.id);
      const osc = await createStudentCard(os.id, oc.id);
      expect((await refund(osc.id)).status).toBe(404);

      auth.userId = nonFinanceId;
      expect((await refund(sc.id)).status).toBe(403);
    });

    it("rejects an already closed card", async () => {
      const sc = await mkCard({});
      await prisma.studentCard.update({ where: { id: sc.id }, data: { expiredAt: new Date() } });
      const r = await refund(sc.id);
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("CARD_CLOSED");
    });
  });
});
