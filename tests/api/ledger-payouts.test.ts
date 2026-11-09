// 財務 v2 P5：付款批次、分部往來轉平、盤點、業主交易、手動分錄、鎖帳、結帳清單（docs/finance-v2/06 P5）。
// 十一月情境走完付款後：應付老師／場地、分部往來皆為 0；丁丁 $5,050、Sean −$2,127（spec §14.6）。
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember } from "../factories";
import { at, LAUNCH, seedNovember, type NovemberWorld } from "../ledgerScenario";
import { checkLedger } from "@/service/ledger/check";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { GET as RUNS, POST as CREATE_RUN } from "@/app/api/finance/payouts/route";
import { PATCH as PATCH_PAYOUT, DELETE as DELETE_PAYOUT } from "@/app/api/finance/payouts/[id]/route";
import { POST as PAID } from "@/app/api/finance/payouts/[id]/paid/route";
import { POST as TRANSFER } from "@/app/api/finance/money-transfers/route";
import { POST as TRANSFER_DONE } from "@/app/api/finance/money-transfers/[id]/done/route";
import { POST as OWNER } from "@/app/api/finance/owner-transactions/route";
import { POST as COUNT } from "@/app/api/finance/cash-counts/route";
import { GET as ACCOUNTS } from "@/app/api/finance/money-accounts/route";
import { POST as JOURNAL } from "@/app/api/finance/journal/route";
import { POST as REVERSE } from "@/app/api/finance/journal/[id]/reverse/route";
import { GET as LOCK_GET, POST as LOCK } from "@/app/api/finance/lock/route";
import { GET as CLOSE } from "@/app/api/finance/close/route";
import { POST as SIGNOFF } from "@/app/api/finance/close/signoff/route";

const req = (body?: unknown, method = "POST", url = "http://t/") =>
  new Request(url, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
const ctx = (id?: number) => ({ params: Promise.resolve(id !== undefined ? { id: String(id) } : {}) }) as never;
const json = async (res: Response) => ({ status: res.status, body: await res.json() });

type Payout = { id: number; name: string; partyType: string; locationId: number; amount: number; paidAmount: number; fromMoneyAccountId: number | null; status: string };

describe("payouts, transfers, counts, locking (finance v2 P5)", () => {
  let classroomId: number;
  let dingId: number;
  let w: NovemberWorld;
  let dingMa: { id: number; accountId: number };
  let seanMa: { id: number; accountId: number };

  const sumOf = async (key: string, where: { locationId?: number; partyType?: string; partyId?: number } = {}) =>
    (await prisma.journalLine.aggregate({ where: { classroomId, account: { systemKey: key }, ...where }, _sum: { amount: true } }))._sum.amount ?? 0;
  const cash = async (ma: { accountId: number }) =>
    (await prisma.journalLine.aggregate({ where: { classroomId, accountId: ma.accountId }, _sum: { amount: true } }))._sum.amount ?? 0;
  const profit = async (locationId: number) =>
    -((await prisma.journalLine.aggregate({ where: { classroomId, locationId, account: { type: { in: ["INCOME", "EXPENSE"] } } }, _sum: { amount: true } }))._sum.amount ?? 0);

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-12-03"));
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    w = await seedNovember(classroomId, dingId);
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeOpenedAt: LAUNCH, financeConversionDate: new Date("2026-11-01T00:00:00Z") } });
    auth.userId = dingId;
    auth.classroomId = classroomId;
    const { body } = await json(await ACCOUNTS(req(undefined, "GET"), ctx()));
    const acc = (u: number) => prisma.moneyAccount.findFirstOrThrow({ where: { classroomId, holderUserId: u }, select: { id: true, accountId: true } });
    expect(body.accounts).toHaveLength(2);
    dingMa = await acc(dingId);
    seanMa = await acc(w.seanId);
  });
  afterAll(() => vi.useRealTimers());

  let run: { id: number; payouts: Payout[]; transfers: { id: number; fromMoneyAccountId: number; toMoneyAccountId: number; amount: number }[] };

  it("a payout run lists every payable per branch, with who pays it and the interbranch settlement", async () => {
    const { status, body } = await json(await CREATE_RUN(req({ asOf: "2026-11-30" }), ctx()));
    expect(status).toBe(200);
    run = body;
    const by = (name: string, loc: number) => run.payouts.find((p) => p.name === name && p.locationId === loc)!;
    expect(run.payouts).toHaveLength(7);
    // 可發的老師份（阿傑沒付的那格不在裡面）、取整到元
    expect(by("丁丁", w.T.id)).toMatchObject({ amount: 135000, paidAmount: 135000, fromMoneyAccountId: dingMa.id });
    expect(by("Nora", w.T.id)).toMatchObject({ amount: 68334, paidAmount: 68300, fromMoneyAccountId: dingMa.id });
    expect(by("Charlene", w.T.id)).toMatchObject({ amount: 66666, paidAmount: 66700, fromMoneyAccountId: dingMa.id });
    expect(by("丁丁家", w.T.id)).toMatchObject({ amount: 150000, fromMoneyAccountId: dingMa.id });
    // 老師的錢由上課分部的負責人付：Sean 在台南的那份由台南負責人丁丁付、高雄的由高雄負責人 Sean 自己付
    // （Sean 連著帳號、有自己的資金帳戶也一樣）
    expect(by("Sean", w.T.id)).toMatchObject({ amount: 36666, paidAmount: 36700, fromMoneyAccountId: dingMa.id });
    expect(by("Sean", w.K.id)).toMatchObject({ amount: 27525, paidAmount: 27500, fromMoneyAccountId: seanMa.id });
    expect(by("高雄搭檔", w.K.id)).toMatchObject({ amount: 27525, paidAmount: 27500, fromMoneyAccountId: seanMa.id });
    // 台南欠高雄 333.33（小明在高雄上課）→ 轉 333
    expect(run.transfers).toEqual([
      expect.objectContaining({ fromMoneyAccountId: dingMa.id, toMoneyAccountId: seanMa.id, amount: 33300, settleAmount: 33333 }),
    ]);
    // 還沒付，帳本不動
    expect(await cash(dingMa)).toBe(995000);
  });

  it("only settlers or the paying account's holder mark a payout paid; then the ledger matches spec §14.6", async () => {
    const nora = await createMember(classroomId, { email: "nora@test.local", name: "Nora", role: "assistant" });
    auth.userId = nora.id;
    expect((await PAID(req({ date: "2026-12-03" }), ctx(run.payouts[0].id))).status).toBe(403);
    auth.userId = w.seanId; // Sean 可以結算
    for (const p of run.payouts) {
      const { status, body } = await json(await PAID(req({ date: "2026-12-03" }), ctx(p.id)));
      expect(status).toBe(200);
      expect(body.status).toBe("PAID");
    }
    expect((await PAID(req({}), ctx(run.payouts[0].id))).status).toBe(409);
    expect((await TRANSFER_DONE(req({ date: "2026-12-03" }), ctx(run.transfers[0].id))).status).toBe(200);
    auth.userId = dingId;

    expect(await sumOf("TEACHER_PAYABLE")).toBe(0);
    expect(await sumOf("VENUE_PAYABLE")).toBe(0);
    expect(await sumOf("INTERBRANCH", { locationId: w.T.id })).toBe(0);
    expect(await sumOf("INTERBRANCH", { locationId: w.K.id })).toBe(0);
    expect(await cash(dingMa)).toBe(505000);
    expect(await cash(seanMa)).toBe(-212700);
    expect(await sumOf("TEACHER_PAYABLE_HELD")).toBe(-22222); // 等阿傑付款
    // 尾差：台南 Nora −0.34、Charlene +0.34、Sean 台南份 +0.34、往來少轉 −0.33；高雄兩筆 −0.25、往來 +0.33
    expect(await sumOf("ROUNDING", { locationId: w.T.id })).toBe(1);
    expect(await sumOf("ROUNDING", { locationId: w.K.id })).toBe(-17);
    expect(await profit(w.T.id)).toBeCloseTo(-23889, -1);
    expect(await profit(w.K.id)).toBeCloseTo(-14866, -1); // spec −148.66
    expect(await checkLedger(classroomId)).toEqual([]);
  });

  it("a second run for the same day finds nothing left to pay", async () => {
    const { body } = await json(await CREATE_RUN(req({ asOf: "2026-11-30" }), ctx()));
    expect(body.payouts).toEqual([]);
    expect(body.transfers).toEqual([]);
    const list = await json(await RUNS(req(undefined, "GET"), ctx()));
    expect(list.body.runs).toHaveLength(2);
  });

  it("voiding a paid payout posts a correction and the amount is owed again", async () => {
    const nora = run.payouts.find((p) => p.name === "Nora")!;
    expect((await DELETE_PAYOUT(req(undefined, "DELETE"), ctx(nora.id))).status).toBe(200);
    expect(await sumOf("TEACHER_PAYABLE", { partyType: "TEACHER", partyId: w.tNora.id })).toBe(-68334);
    expect(await cash(dingMa)).toBe(505000 + 68300);
    const again = (await json(await CREATE_RUN(req({ asOf: "2026-11-30" }), ctx()))).body;
    expect(again.payouts).toEqual([expect.objectContaining({ name: "Nora", amount: 68334 })]);
    // 還沒付的可以改實付、直接刪
    const p = again.payouts[0];
    expect((await json(await PATCH_PAYOUT(req({ paidAmount: 68334 }, "PATCH"), ctx(p.id)))).body.paidAmount).toBe(68334);
    expect((await PAID(req({ date: "2026-12-04" }), ctx(p.id))).status).toBe(200);
    expect(await sumOf("TEACHER_PAYABLE", { partyType: "TEACHER", partyId: w.tNora.id })).toBe(0);
    expect(await cash(dingMa)).toBe(505000 - 34);
  });

  it("an owner advance becomes a payable to that person; contributions and drawings move cash against equity", async () => {
    await prisma.financeExpense.create({
      data: { classroomId, date: at("2026-12-04"), amount: 300, locationId: w.T.id, category: "海報", paidByUserId: dingId, isAdvance: true, createdById: dingId },
    });
    const r = (await json(await CREATE_RUN(req({ asOf: "2026-12-04" }), ctx()))).body;
    expect(r.payouts).toEqual([expect.objectContaining({ partyType: "USER", name: expect.any(String), amount: 30000, fromMoneyAccountId: dingMa.id })]);

    const before = await cash(seanMa);
    expect((await OWNER(req({ kind: "CONTRIBUTION", userId: w.seanId, amount: 300000, moneyAccountId: seanMa.id, date: "2026-12-04" }), ctx())).status).toBe(200);
    expect((await OWNER(req({ kind: "DRAWING", userId: w.seanId, amount: 50000, moneyAccountId: seanMa.id, date: "2026-12-04" }), ctx())).status).toBe(200);
    expect(await cash(seanMa)).toBe(before + 250000);
    expect(await sumOf("OWNER_CONTRIBUTION")).toBe(-300000);
    expect(await sumOf("OWNER_DRAWING")).toBe(50000);
    expect((await OWNER(req({ kind: "DIVIDEND", userId: dingId, amount: 1000, locationId: w.K.id, date: "2026-12-04" }), ctx())).status).toBe(200);
    expect(await sumOf("OWNER_PAYABLE", { locationId: w.K.id })).toBe(-1000);
    expect((await OWNER(req({ kind: "DIVIDEND", userId: dingId, amount: 1000 }), ctx())).status).toBe(400);
  });

  it("a cash count books the difference to cash over/short", async () => {
    const system = await cash(dingMa);
    const { status, body } = await json(await COUNT(req({ moneyAccountId: dingMa.id, counted: system - 5000, date: "2026-12-04" }), ctx()));
    expect(status).toBe(200);
    expect(body).toMatchObject({ systemBalance: system, difference: -5000 });
    expect(await cash(dingMa)).toBe(system - 5000);
    expect(await sumOf("CASH_OVER_SHORT")).toBe(5000);
    const accounts = (await json(await ACCOUNTS(req(undefined, "GET"), ctx()))).body.accounts;
    expect(accounts.find((a: { id: number }) => a.id === dingMa.id)).toMatchObject({ balance: system - 5000, lastCount: { date: "2026-12-04", difference: -5000 } });
  });

  it("manual entries must balance, get interbranch lines across branches, and can only be reversed once", async () => {
    const general = await prisma.ledgerAccount.findFirstOrThrow({ where: { classroomId, systemKey: "EXPENSE_GENERAL" } });
    const cashParent = await prisma.ledgerAccount.findFirstOrThrow({ where: { classroomId, systemKey: "CASH" } });
    const bad = await JOURNAL(req({ date: "2026-12-04", memo: "x", lines: [{ accountId: general.id, locationId: w.T.id, amount: 100 }, { accountId: seanMa.accountId, locationId: w.K.id, amount: -99 }] }), ctx());
    expect((await json(bad)).body.code).toBe("UNBALANCED");
    expect((await JOURNAL(req({ date: "2026-12-04", memo: "x", lines: [{ accountId: general.id, locationId: w.T.id, amount: 100 }, { accountId: cashParent.id, locationId: w.T.id, amount: -100 }] }), ctx())).status).toBe(400);
    expect((await JOURNAL(req({ date: "2026-12-04", memo: "x", lines: [{ accountId: general.id, locationId: w.T.id, amount: 100 }, { accountId: seanMa.accountId, locationId: w.T.id, amount: -100 }] }), ctx())).status).toBe(400);

    const { status, body } = await json(
      await JOURNAL(req({ date: "2026-12-04", memo: "台南的費用 Sean 付", lines: [{ accountId: general.id, locationId: w.T.id, amount: 10000 }, { accountId: seanMa.accountId, locationId: w.K.id, amount: -10000 }] }), ctx()),
    );
    expect(status).toBe(200);
    expect(body.kind).toBe("MANUAL");
    expect(body.lines).toHaveLength(4); // 兩行＋兩分部往來
    expect(await checkLedger(classroomId)).toEqual([]);

    const rev = await json(await REVERSE(req({ date: "2026-12-05" }), ctx(body.id)));
    expect(rev.status).toBe(200);
    expect(rev.body).toMatchObject({ kind: "REVERSAL", reversesId: body.id });
    expect((await json(await REVERSE(req({}), ctx(body.id)))).body.code).toBe("ALREADY_REVERSED");
    const auto = await prisma.journalEntry.findFirstOrThrow({ where: { classroomId, kind: "AUTO" } });
    expect((await json(await REVERSE(req({}), ctx(auto.id)))).body.code).toBe("NOT_REVERSIBLE");
  });

  it("close checklist, branch sign-off, lock forward by settlers, unlock by the owner only", async () => {
    const list = (await json(await CLOSE(req(undefined, "GET", "http://t/?asOf=2026-11-30"), ctx()))).body;
    const item = (k: string) => list.items.find((i: { key: string }) => i.key === k);
    expect(item("ATTENDANCE").done).toBe(true);
    expect(item("SPLIT_RULES").done).toBe(true);
    expect(item("RECEIVABLES")).toMatchObject({ done: false, count: 1, total: 200000 }); // 阿傑
    expect(item("SIGNOFFS").done).toBe(false);

    auth.userId = w.seanId; // 高雄負責人
    expect((await SIGNOFF(req({ locationId: w.T.id, asOf: "2026-11-30" }), ctx())).status).toBe(403);
    expect((await SIGNOFF(req({ locationId: w.K.id, asOf: "2026-11-30" }), ctx())).status).toBe(200);
    auth.userId = dingId;
    expect((await SIGNOFF(req({ locationId: w.T.id, asOf: "2026-11-30" }), ctx())).status).toBe(200);
    const after = (await json(await CLOSE(req(undefined, "GET", "http://t/?asOf=2026-11-30"), ctx()))).body;
    expect(after.items.find((i: { key: string }) => i.key === "SIGNOFFS").done).toBe(true);

    expect((await json(await LOCK(req({ lockDate: "2026-12-31" }), ctx()))).body.code).toBe("LOCK_IN_FUTURE");
    auth.userId = w.seanId;
    expect((await LOCK(req({ lockDate: "2026-11-30" }), ctx())).status).toBe(200);
    // 鎖住的日子不能再記
    const general = await prisma.ledgerAccount.findFirstOrThrow({ where: { classroomId, systemKey: "EXPENSE_GENERAL" } });
    const locked = await JOURNAL(req({ date: "2026-11-29", memo: "x", lines: [{ accountId: general.id, locationId: w.T.id, amount: 100 }, { accountId: dingMa.accountId, locationId: w.T.id, amount: -100 }] }), ctx());
    expect((await json(locked)).body.code).toBe("PERIOD_LOCKED");
    expect((await json(await TRANSFER(req({ fromMoneyAccountId: dingMa.id, toMoneyAccountId: seanMa.id, amount: 100, date: "2026-11-30" }), ctx()))).body.code).toBe("PERIOD_LOCKED");
    expect((await json(await LOCK(req({ lockDate: null }), ctx()))).body.code).toBe("OWNER_ONLY");
    auth.userId = dingId;
    expect((await LOCK(req({ lockDate: "2026-11-15" }), ctx())).status).toBe(200);
    const state = (await json(await LOCK_GET(req(undefined, "GET"), ctx()))).body;
    expect(state.lockDate).toBe("2026-11-15");
    expect(state.history.map((h: { fromDate: string | null; toDate: string | null }) => [h.fromDate, h.toDate])).toEqual([
      ["2026-11-30", "2026-11-15"],
      [null, "2026-11-30"],
    ]);
  });

  it("locking needs an opened ledger", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeOpenedAt: null } });
    expect((await json(await LOCK(req({ lockDate: "2026-11-30" }), ctx()))).body.code).toBe("LEDGER_NOT_OPENED");
  });
});

// 老師的錢永遠由上課分部的負責人付（2026-11-10 定案）：Sean 在高雄（負責人 Sean）和台南（負責人丁丁）都有課，
// 就算 Sean 連著帳號、在台南也有自己的資金帳戶，台南那幾堂仍從丁丁的台南帳戶付，高雄的從 Sean 的高雄帳戶付。
describe("teacher pay comes from the keeper of the branch where the lesson happened", () => {
  it("Sean: 高雄 periods from Sean's 高雄 account, 台南 periods from 丁丁's 台南 account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-12-03"));
    try {
      await resetDb();
      const c = await createClassroom();
      const w = await seedNovember(c.id, c.ownerId);
      await prisma.classroom.update({ where: { id: c.id }, data: { financeOpenedAt: LAUNCH, financeConversionDate: new Date("2026-11-01T00:00:00Z") } });
      auth.userId = c.ownerId;
      auth.classroomId = c.id;
      await ACCOUNTS(req(undefined, "GET"), ctx()); // 負責人的帳戶在第一次讀時建好
      // Sean 在台南也有一個自己的帳戶——不該被拿來付他台南的鐘點
      const seanTainan = await json(await (await import("@/app/api/finance/money-accounts/route")).POST(
        req({ holderUserId: w.seanId, locationId: w.T.id, name: "Sean 台南" }),
        ctx(),
      ));
      expect(seanTainan.status).toBe(200);
      const ma = (u: number, loc: number) =>
        prisma.moneyAccount.findFirstOrThrow({ where: { classroomId: c.id, holderUserId: u, locationId: loc }, orderBy: { id: "asc" }, select: { id: true } });
      const dingTainan = await ma(c.ownerId, w.T.id);
      const seanKao = await ma(w.seanId, w.K.id);

      const { body } = await json(await CREATE_RUN(req({ asOf: "2026-11-30" }), ctx()));
      const sean = (loc: number) => (body.payouts as Payout[]).find((p) => p.name === "Sean" && p.locationId === loc)!;
      expect(sean(w.T.id).fromMoneyAccountId).toBe(dingTainan.id);
      expect(sean(w.K.id).fromMoneyAccountId).toBe(seanKao.id);
      expect(sean(w.T.id).fromMoneyAccountId).not.toBe(seanTainan.body.id);
      // 高雄搭檔沒連帳號，也由高雄負責人付
      expect((body.payouts as Payout[]).find((p) => p.name === "高雄搭檔")!.fromMoneyAccountId).toBe(seanKao.id);
    } finally {
      vi.useRealTimers();
    }
  });
});
