// 財務 v2 P4：報表（docs/finance-v2/05 §3）。用十一月情境驗證每張表的數字與互相勾稽。
import { describe, it, expect, beforeAll, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom } from "../factories";
import { seedNovember, type NovemberWorld } from "../ledgerScenario";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { GET } from "@/app/api/finance/reports/[name]/route";

const get = async (name: string, qs = "") => {
  const res = await GET(new Request(`http://t/api/finance/reports/${name}?${qs}`), { params: Promise.resolve({ name }) });
  return { status: res.status, body: await res.json() };
};
const NOV = "from=2026-11-01&to=2026-11-30";

describe("ledger reports (finance v2 P4)", () => {
  let w: NovemberWorld;
  let dingId: number;
  let classroomId: number;

  beforeAll(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    auth.userId = dingId;
    auth.classroomId = c.id;
    w = await seedNovember(c.id, dingId);
  });

  it("P&L by branch: gross profit is what used to go to the fund, net = after expenses", async () => {
    const { status, body } = await get("pnl", NOV);
    expect(status).toBe(200);
    expect(body.netIncome.byLocation[w.T.id]).toBeCloseTo(-23889, -1);
    expect(body.netIncome.byLocation[w.K.id]).toBeCloseTo(6117 - 21000, -1);
    expect(body.netIncome.total).toBe(body.netIncome.byLocation[w.T.id] + body.netIncome.byLocation[w.K.id]);
    expect(body.grossProfit.byLocation[w.T.id]).toBeCloseTo(26111, -1);
    expect(body.expenses.lines.map((l: { name: string }) => l.name).sort()).toEqual(["廣告", "飲料"]);
  });

  it("balance sheet balances for each branch and in total; interbranch nets out", async () => {
    const { body } = await get("balance-sheet", "asOf=2026-11-30");
    expect(body.balanced).toBe(true);
    const line = (list: { key: string; label: string; total: number; byLocation: Record<number, number> }[], label: string) =>
      list.find((l) => l.label === label)!;
    expect(line(body.liabilities, "預收學費").total).toBe(706670 + 166667);
    expect(line(body.assets, "分部往來（應收）").byLocation[w.K.id]).toBe(33333);
    expect(line(body.liabilities, "分部往來（應付）").byLocation[w.T.id]).toBe(33333);
    expect(line(body.assets, "分部往來（應收）").total).toBe(0);
    // 公積金＝累積淨利（沒有期初）
    expect(line(body.equity, "公積金（累積盈餘）").byLocation[w.T.id]).toBeCloseTo(-23889, -1);
  });

  it("trial balance: debits = credits", async () => {
    const { body } = await get("trial-balance", "asOf=2026-11-30");
    expect(body.totalDebit).toBe(body.totalCredit);
    expect(body.rows.length).toBeGreaterThan(5);
  });

  it("cash flow ends at each money account's balance", async () => {
    const { body } = await get("cash-flow", NOV);
    expect(body.opening.total).toBe(0);
    expect(body.closing.byLocation[w.T.id]).toBe(995000);
    expect(body.closing.byLocation[w.K.id]).toBe(-191000);
    const cat = (c: string) => body.flows.find((f: { category: string }) => f.category === c)?.total ?? 0;
    expect(cat("TUITION")).toBe(1200000);
    expect(cat("DROP_IN")).toBe(80000);
    expect(cat("EXPENSE")).toBe(-71000);
    expect(cat("VENUE_PACK")).toBe(-405000);
    expect(body.opening.total + body.flows.reduce((s: number, f: { total: number }) => s + f.total, 0)).toBe(body.closing.total);
  });

  it("deferred revenue rolls forward and lists the cards", async () => {
    const { body } = await get("deferred-revenue", NOV);
    expect(body.opening).toBe(0);
    expect(body.opening + body.sold - body.recognized - body.closed).toBe(body.closing);
    expect(body.closing).toBe(706670 + 166667);
    expect(body.sold).toBe(1400000); // 7 張 $2,000 的卡（含阿傑沒付的；贈送卡 $0 不算）
    expect(body.cards.find((c: { cardId: number }) => c.cardId === w.jie.cardId)).toMatchObject({
      balance: 166667,
      isPaid: false,
      purchasedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      remainingSessions: expect.any(Number),
    });
    expect(body.cards[0].name).toMatch(/·/);
  });

  it("receivables and payables", async () => {
    const ar = (await get("receivables", "asOf=2026-11-30")).body;
    expect(ar.total).toBe(200000);
    expect(ar.items).toEqual([expect.objectContaining({ partyType: "STUDENT_CARD", partyId: w.jie.cardId, balance: 200000, bucket: "0-30", ageDays: 4 })]);
    expect(ar.items[0].name).toContain("阿傑");

    const ap = (await get("payables", "asOf=2026-11-30")).body;
    const ding = ap.items.find((i: { partyType: string; partyId: number }) => i.partyType === "TEACHER" && i.partyId === w.tDing.id);
    expect(ding.payable).toBeCloseTo(135000, -1);
    expect(ding.held).toBe(11111);
    expect(ding.name).toBe("丁丁");
    expect(ap.totalHeld).toBe(22222);
    // 丁丁家的場租 5 堂 × 300（應付場地，成員房東）
    expect(ap.items.find((i: { name: string }) => i.name === "丁丁家").payable).toBe(150000);
  });

  it("lesson profitability groups periods by lesson", async () => {
    const { body } = await get("lessons", NOV);
    const by = (name: string) => body.lessons.find((l: { name: string }) => l.name === name);
    expect(by("Bachata Training")).toMatchObject({ periods: 1, venue: 40500 });
    expect(by("Bachata Training").revenue).toBe(33333 * 2 + 35000);
    expect(by("週四期班").periods).toBe(2);
    expect(by("Body movement").gross).toBe(0); // 剩下的全給 Sean
    expect(by("Bachata Training").locationIds).toHaveLength(1);
  });

  it("general ledger of the cash parent shows every money account movement with a running balance", async () => {
    const tb = (await get("trial-balance", "asOf=2026-11-30")).body;
    const cashParent = tb.rows.find((r: { code: string }) => r.code === "1111.01");
    expect(cashParent).toBeTruthy();
    const { body } = await get("general-ledger", `${NOV}&accountId=${cashParent.accountId}`);
    expect(body.closing).toBe(995000);
    expect(body.lines.at(-1).running).toBe(995000);
  });

  it("validates input", async () => {
    expect((await get("nope")).status).toBe(404);
    expect((await get("general-ledger", NOV)).status).toBe(400);
    expect((await get("pnl", "from=2026-12-01&to=2026-11-01")).status).toBe(400);
    expect((await get("pnl", "from=11/1")).status).toBe(400);
  });

  it("money account statement says who a payment went to and where a transfer went", async () => {
    const mas = await prisma.moneyAccount.findMany({ where: { classroomId }, orderBy: { id: "asc" } });
    const from = mas.find((m) => m.locationId === w.T.id)!;
    const to = mas.find((m) => m.id !== from.id)!;
    await prisma.payout.create({
      data: {
        classroomId, partyType: "TEACHER", partyId: w.tDing.id, payableKey: "TEACHER_PAYABLE", locationId: w.T.id,
        amount: 10000, paidAmount: 10000, fromMoneyAccountId: from.id, status: "PAID", paidDate: new Date("2026-11-29T00:00:00Z"), createdById: dingId,
      },
    });
    await prisma.moneyTransfer.create({
      data: { classroomId, fromMoneyAccountId: from.id, toMoneyAccountId: to.id, amount: 5000, status: "PAID", date: new Date("2026-11-29T00:00:00Z"), createdById: dingId },
    });
    const gl = (accountId: number) => get("general-ledger", `${NOV}&accountId=${accountId}`);
    const out = (await gl(from.accountId)).body.lines;
    expect(out.find((l: { sourceType: string }) => l.sourceType === "PAYOUT")).toMatchObject({ amount: -10000, party: "丁丁" });
    expect(out.find((l: { sourceType: string }) => l.sourceType === "MONEY_TRANSFER")).toMatchObject({ amount: -5000, party: `轉給 ${to.name}` });
    const inn = (await gl(to.accountId)).body.lines;
    expect(inn.find((l: { sourceType: string }) => l.sourceType === "MONEY_TRANSFER")).toMatchObject({ amount: 5000, party: `來自 ${from.name}` });
  });
});
