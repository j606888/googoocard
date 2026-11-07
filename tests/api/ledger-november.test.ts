// 財務 v2 P2 驗收：設計文件 §14 的十一月情境過帳後，老師可發金額、分部往來、現金、預收、各分部利潤
// 都要對（docs/finance-v2/06-phases.md P2）。
import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember } from "../factories";
import { at, seedNovember, type NovemberWorld as W } from "../ledgerScenario";
import { syncLedger } from "@/service/ledger/sync";
import { checkLedger } from "@/service/ledger/check";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { POST as SYNC } from "@/app/api/finance/ledger/sync/route";
import { GET as CHECK } from "@/app/api/finance/ledger/check/route";

/** 某科目（systemKey）的餘額（分，借正貸負），可依分部、對象篩。 */
async function balance(classroomId: number, key: string, where: { locationId?: number; partyType?: string; partyId?: number; upTo?: string } = {}) {
  const r = await prisma.journalLine.aggregate({
    where: {
      classroomId,
      account: { systemKey: key },
      ...(where.locationId !== undefined ? { locationId: where.locationId } : {}),
      ...(where.partyType !== undefined ? { partyType: where.partyType } : {}),
      ...(where.partyId !== undefined ? { partyId: where.partyId } : {}),
      ...(where.upTo ? { date: { lte: new Date(`${where.upTo}T00:00:00Z`) } } : {}),
    },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

async function cashOf(classroomId: number, holderUserId: number) {
  const ma = await prisma.moneyAccount.findFirstOrThrow({ where: { classroomId, holderUserId } });
  const r = await prisma.journalLine.aggregate({ where: { classroomId, accountId: ma.accountId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

/** 分部利潤（分）：收入（貸，負）＋費用（借，正）取負號。 */
async function profit(classroomId: number, locationId: number) {
  const r = await prisma.journalLine.aggregate({
    where: { classroomId, locationId, account: { type: { in: ["INCOME", "EXPENSE"] } } },
    _sum: { amount: true },
  });
  return -(r._sum.amount ?? 0);
}

describe("ledger posting — November scenario (finance v2 P2)", () => {
  let classroomId: number;
  let dingId: number;
  let w: W;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    w = await seedNovember(classroomId, dingId);
    auth.userId = dingId;
    auth.classroomId = classroomId;
  });

  it("API: settle member can sync; anyone can run the health check; non-settlers can't sync", async () => {
    const noParams = { params: Promise.resolve({}) };
    const res = await SYNC(new Request("http://t/api", { method: "POST" }), noParams);
    expect(res.status).toBe(200);
    const check = await CHECK(new Request("http://t/api"), noParams);
    expect(await check.json()).toMatchObject({ ok: true, problems: [] });

    const other = await createMember(classroomId, { email: "nora@test.local", name: "Nora" });
    auth.userId = other.id;
    expect((await SYNC(new Request("http://t/api", { method: "POST" }), noParams)).status).toBe(403);
    expect((await CHECK(new Request("http://t/api"), noParams)).status).toBe(200);
  });

  it("posts every source, balanced, and the ledger is healthy", async () => {
    const r = await syncLedger(classroomId);
    expect(r.errors).toEqual([]);
    expect(r.entriesWritten).toBeGreaterThan(0);
    expect(await checkLedger(classroomId)).toEqual([]);

    const total = await prisma.journalLine.aggregate({ where: { classroomId }, _sum: { amount: true } });
    expect(total._sum.amount).toBe(0);
  });

  it("is idempotent", async () => {
    await syncLedger(classroomId);
    const n = await prisma.journalEntry.count({ where: { classroomId } });
    const again = await syncLedger(classroomId);
    expect(again).toEqual({ entriesWritten: 0, sourcesChanged: 0, errors: [] });
    expect(await prisma.journalEntry.count({ where: { classroomId } })).toBe(n);
  });

  it("teachers can be paid exactly what feat/finance computed; the unpaid card's share is held", async () => {
    await syncLedger(classroomId);
    const payable = (teacherId: number) => balance(classroomId, "TEACHER_PAYABLE", { partyType: "TEACHER", partyId: teacherId });
    const held = (teacherId: number) => balance(classroomId, "TEACHER_PAYABLE_HELD", { partyType: "TEACHER", partyId: teacherId });

    // spec §14.4：丁丁 1,350、Nora 683.34、Charlene 666.66、Sean 641.92、高雄搭檔 275.25（分，可差 1 分尾差）
    expect(-(await payable(w.tDing.id))).toBeCloseTo(135000, -1);
    expect(-(await payable(w.tNora.id))).toBeCloseTo(68334, -1);
    expect(-(await payable(w.tCharlene.id))).toBeCloseTo(66666, -1);
    expect(-(await payable(w.tSean.id))).toBeCloseTo(64192, -1);
    expect(-(await payable(w.tPartner.id))).toBeCloseTo(27525, -1);
    // 阿傑沒付款：L6 多出的 1/3 份先不發
    expect(-(await held(w.tDing.id))).toBe(11111);
    expect(-(await held(w.tCharlene.id))).toBe(11111);
    expect(await held(w.tNora.id)).toBe(0);
  });

  it("cash, deferred revenue, interbranch and branch profit match the hand-computed month", async () => {
    await syncLedger(classroomId);
    // 現金只看收付：丁丁 10,450 − 500；Sean 2,350 − 4,050 − 210
    expect(await cashOf(classroomId, dingId)).toBe(995000);
    expect(await cashOf(classroomId, w.seanId)).toBe(-191000);

    // 預收：台南 5,400＋阿傑剩 5 格；高雄 小強剩 5 格（最後一格吃尾差）
    expect(-(await balance(classroomId, "DEFERRED_REVENUE", { locationId: w.T.id }))).toBe(706670);
    expect(-(await balance(classroomId, "DEFERRED_REVENUE", { locationId: w.K.id }))).toBe(166667);
    expect(await balance(classroomId, "AR")).toBe(200000);

    // 小明用台南的卡上高雄的課 → 台南欠高雄一格
    expect(await balance(classroomId, "INTERBRANCH", { locationId: w.T.id })).toBe(-33333);
    expect(await balance(classroomId, "INTERBRANCH", { locationId: w.K.id })).toBe(33333);

    // 預付場地：24steps 用了 1 次
    expect(await balance(classroomId, "PREPAID_VENUE")).toBe(405000 - 40500);

    // 分部利潤＝公積金變化：台南 −238.89（舊版 −350 ＋ 阿傑那格 111.11）、高雄 61.17 − 210
    expect(await profit(classroomId, w.T.id)).toBeCloseTo(-23889, -1);
    expect(await profit(classroomId, w.K.id)).toBeCloseTo(6117 - 21000, -1);
  });

  it("a change after the lock date is posted the day after the lock, and old entries never move", async () => {
    await syncLedger(classroomId);
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: new Date("2026-11-30T00:00:00Z") } });
    const before = await prisma.journalLine.count({ where: { classroomId, date: { lte: new Date("2026-11-30T00:00:00Z") } } });

    // 12/8 阿傑付款給丁丁
    await prisma.studentCard.update({ where: { id: w.jie.cardId }, data: { isPaid: true, paidAt: at("2026-12-08"), paidByUserId: dingId } });
    const r = await syncLedger(classroomId);
    expect(r.errors).toEqual([]);

    expect(await prisma.journalLine.count({ where: { classroomId, date: { lte: new Date("2026-11-30T00:00:00Z") } } })).toBe(before);
    // L6 待學生付款 → 可發，記在 12/1；收款記在 12/8
    const corr = await prisma.journalEntry.findMany({ where: { classroomId, kind: "CORRECTION" }, select: { date: true, sourceType: true } });
    expect(corr.map((e) => [e.sourceType, e.date.toISOString().slice(0, 10)]).sort()).toEqual([
      ["CARD", "2026-12-08"],
      ["PERIOD", "2026-12-01"],
    ]);
    expect(await balance(classroomId, "TEACHER_PAYABLE_HELD")).toBe(0);
    expect(await balance(classroomId, "AR")).toBe(0);
    expect(await checkLedger(classroomId)).toEqual([]);
  });

  it("removing an attendance reverses exactly that attendance", async () => {
    await syncLedger(classroomId);
    const revenueBefore = await balance(classroomId, "REVENUE_LESSON");
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: w.L6.id, studentCardId: w.jie.cardId } });
    await prisma.attendanceRecord.delete({ where: { id: rec.id } });
    await prisma.studentCard.update({ where: { id: w.jie.cardId }, data: { remainingSessions: 6 } });
    await syncLedger(classroomId);
    expect((await balance(classroomId, "REVENUE_LESSON")) - revenueBefore).toBe(33333);
    expect(await balance(classroomId, "TEACHER_PAYABLE_HELD")).toBe(0);
    expect(await checkLedger(classroomId)).toEqual([]);
  });
});
