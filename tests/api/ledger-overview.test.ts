// 財務 v2 P6：總覽、老師報酬單、代墊支出（docs/finance-v2/05 §3.1、§3.8）。
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom } from "../factories";
import { at, LAUNCH, seedNovember, type NovemberWorld } from "../ledgerScenario";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { GET as OVERVIEW } from "@/app/api/finance/overview/route";
import { GET as STATEMENT } from "@/app/api/finance/statements/teachers/[id]/route";
import { POST as EXPENSE } from "@/app/api/finance/expenses/route";
import { GET as ACCOUNTS } from "@/app/api/finance/ledger/accounts/route";

const get = async (h: (r: Request, c: never) => Promise<Response>, url: string, id?: number) => {
  const res = await h(new Request(url), { params: Promise.resolve(id !== undefined ? { id: String(id) } : {}) } as never);
  return { status: res.status, body: await res.json() };
};

describe("finance overview & statements (finance v2 P6)", () => {
  let w: NovemberWorld;
  let classroomId: number;
  let dingId: number;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-12-03"));
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    auth.userId = dingId;
    auth.classroomId = c.id;
    w = await seedNovember(c.id, dingId);
    await prisma.classroom.update({ where: { id: c.id }, data: { financeOpenedAt: LAUNCH, financeConversionDate: new Date("2026-11-01T00:00:00Z") } });
  });
  afterAll(() => vi.useRealTimers());

  it("overview numbers for November", async () => {
    const { status, body } = await get(OVERVIEW, "http://t/?from=2026-11-01&to=2026-11-30");
    expect(status).toBe(200);
    expect(body.netIncome.total).toBeCloseTo(-38775, -1);
    expect(body.cash.total).toBe(804000);
    expect(body.cash.accounts).toHaveLength(2);
    expect(body.deferred.total).toBe(706670 + 166667);
    expect(body.deferred).toMatchObject({ cards: 7, sessions: 25 });
    expect(body.payable.total).toBe(511716);
    expect(body.held.total).toBe(22222);
    expect(body.receivable).toMatchObject({ total: 200000, count: 1, maxAgeDays: 4 });
    // 阿傑沒付的卡：不算進「欠的」
    expect(body.cardReceivable.total).toBe(200000);
    expect(body.cardReceivable.byLocation[w.T.id]).toBe(200000);
    expect(body.cashOverShort.total).toBe(0);
    for (const l of body.losingLessons) expect(l.total).toBeLessThan(0);
    expect(body.fund.byLocation[w.T.id]).toBeCloseTo(-23891, -1);
    expect(body.trend).toHaveLength(6);
    expect(body.trend[4].income).toBeNull(); // 10 月：開帳前
    expect(body.trend[5].income.total).toBe(606663);
    expect(body.todos.receivables[0]).toMatchObject({ studentName: "阿傑", balance: 200000 });
    expect(body.todos.closeDue).toBe("2026-11-30");
  });

  it("teacher statement lists each period, with the part waiting on a student", async () => {
    const { body } = await get(STATEMENT, "http://t/?from=2026-11-01&to=2026-11-30", w.tCharlene.id);
    expect(body.teacher.name).toBe("Charlene");
    expect(body.rows).toHaveLength(2);
    expect(body.rows[1]).toMatchObject({ earned: 44444, held: 11111, students: 4 });
    expect(body.payable).toBe(66666);
    expect(body.held).toBe(11111);
    expect((await get(STATEMENT, "http://t/", 999999)).status).toBe(404);
  });

  it("an advance expense through the API becomes a payable to that member", async () => {
    const res = await EXPENSE(
      new Request("http://t/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-12-02", amount: 300, locationId: w.T.id, category: "海報", paidByUserId: dingId, isAdvance: true }),
      }),
      { params: Promise.resolve({}) } as never,
    );
    expect(res.status).toBe(200);
    const owed = await prisma.journalLine.aggregate({ where: { classroomId, account: { systemKey: "OWNER_PAYABLE" }, partyType: "USER", partyId: dingId }, _sum: { amount: true } });
    expect(owed._sum.amount).toBe(-30000);
    const { body } = await get(ACCOUNTS, "http://t/");
    expect(body.accounts.find((a: { systemKey: string }) => a.systemKey === "CASH")).toBeTruthy();
  });

  it("a cash-count shortage shows as part of expenses; next-step hints at the start of a month", async () => {
    let { body } = await get(OVERVIEW, "http://t/?from=2026-12-01&to=2026-12-31");
    // 12/3：月初、還沒建 11 月的付款批次、兩個現金帳戶都還沒盤點
    expect(body.todos.hints.payoutRunDue).toBe(true);
    expect(body.todos.hints.countDue).toHaveLength(2);
    const ma = body.cash.accounts[0];
    await prisma.cashCount.create({
      data: { classroomId, moneyAccountId: ma.id, date: new Date("2026-12-02T00:00:00Z"), systemBalance: ma.balance, counted: ma.balance - 2200, createdById: dingId },
    });
    ({ body } = await get(OVERVIEW, "http://t/?from=2026-12-01&to=2026-12-31"));
    expect(body.cashOverShort.total).toBe(2200);
    expect(body.expenses.total).toBe(30000 + 2200); // 海報 $300 + 盤點短少 $22
    expect(body.todos.hints.countDue.map((m: { id: number }) => m.id)).not.toContain(ma.id);
  });
});
