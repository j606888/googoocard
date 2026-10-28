import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  enableModule,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

const pushes = vi.hoisted(() => [] as { userIds: number[]; title: string }[]);
vi.mock("@/service/push", () => ({
  notifyUsers: async (_c: number, userIds: number[], push: { title: string }) => {
    pushes.push({ userIds, title: push.title });
  },
  notifyClassroom: async () => {},
}));

import { GET as SETTING, PATCH as PATCH_SETTING } from "@/app/api/finance/setting/route";
import { PUT as SET_OWNER } from "@/app/api/finance/setting/revenue-owner/route";
import { GET as SETTING_HISTORY } from "@/app/api/finance/setting/history/route";
import { POST as SETUP } from "@/app/api/finance/setup/route";
import { GET as OVERVIEW } from "@/app/api/finance/overview/route";
import { GET as HOLDER } from "@/app/api/finance/holders/[userId]/route";
import { GET as VAULT } from "@/app/api/finance/vault/route";
import { POST as REMIT } from "@/app/api/finance/remittances/route";
import { PATCH as EDIT_REMIT } from "@/app/api/finance/remittances/[id]/route";
import { POST as WITHDRAW } from "@/app/api/finance/remittances/[id]/withdraw/route";
import { POST as CONFIRM } from "@/app/api/finance/remittances/[id]/confirm/route";
import { POST as REJECT } from "@/app/api/finance/remittances/[id]/reject/route";
import { POST as ADD_ENTRY } from "@/app/api/finance/entries/route";
import { PATCH as EDIT_ENTRY } from "@/app/api/finance/entries/[id]/route";
import { POST as VOID_ENTRY } from "@/app/api/finance/entries/[id]/void/route";
import { GET as ENTRY_HISTORY } from "@/app/api/finance/entries/[id]/history/route";
import { GET as QUESTS, POST as MARK_QUEST } from "@/app/api/finance/quests/route";

const as = (userId: number) => {
  auth.userId = userId;
};
const byId = (id: number) => routeParams({ id: String(id) });
const json = async (res: Response) => ({ status: res.status, body: await res.json() });

// 測試裡的時間要在「現在」之前：繳回、確認用的是真實時間。
const START = "2026-10-01";
const day = (key: string, hour = 12) => new Date(parseTaipeiDateRange(key).start.getTime() + hour * 3600_000);

/** 丁丁（擁有者）、Sean（老師、營收負責人）、Nini（老師）。 */
async function seed({ module = true } = {}) {
  await resetDb();
  const classroom = await createClassroom({ name: "Bailamore" });
  auth.classroomId = classroom.id;
  const dd = await prisma.user.findUniqueOrThrow({ where: { id: 1 } });
  const sean = await createMember(classroom.id, { email: "sean@test.local", name: "Sean", role: "teacher" });
  const nini = await createMember(classroom.id, { email: "nini@test.local", name: "Nini", role: "teacher" });
  if (module) await enableModule(classroom.id, "finance");
  const student = await createStudent(classroom.id, { name: "麗心" });
  const card = await createCard(classroom.id, { name: "4 堂", price: 2000, sessions: 4 });
  as(dd.id);
  pushes.length = 0;
  return { classroom, dd, sean, nini, student, card };
}

/** 一張啟用日之後付款的卡，收款人 paidBy。 */
async function paidCard(s: Awaited<ReturnType<typeof seed>>, paidBy: number | null, amount = 2000, at = day("2026-10-05")) {
  const sc = await createStudentCard(s.student.id, s.card.id, { finalPrice: amount, totalSessions: 4, remainingSessions: 4 });
  return prisma.studentCard.update({ where: { id: sc.id }, data: { isPaid: true, paidAt: at, paidByUserId: paidBy } });
}

async function setupDone(s: Awaited<ReturnType<typeof seed>>, extra: Record<string, unknown> = {}) {
  const res = await SETUP(
    jsonRequest("POST", {
      revenueOwnerUserId: s.sean.id,
      startDate: START,
      openingBalance: 38000,
      openingOwnerLoan: 120000,
      openingCustody: [{ userId: s.dd.id, amount: 3200 }],
      ...extra,
    }),
    routeParams({})
  );
  expect(res.status).toBe(200);
}

const overview = async () => (await OVERVIEW(jsonRequest("GET"), routeParams({}))).json();
const remit = (amount: number, extra: Record<string, unknown> = {}) =>
  REMIT(jsonRequest("POST", { amount, method: "CASH", sentOn: "2026-11-01", ...extra }), routeParams({}));

beforeEach(() => {
  pushes.length = 0;
});

describe("模組與權限", () => {
  it("模組關著 → 404", async () => {
    await seed({ module: false });
    expect((await OVERVIEW(jsonRequest("GET"), routeParams({}))).status).toBe(404);
  });

  it("全公開：小幫手也看得到", async () => {
    const s = await seed();
    await setupDone(s);
    const helper = await createMember(s.classroom.id, { email: "h@test.local", name: "小安", role: "assistant" });
    as(helper.id);
    expect((await OVERVIEW(jsonRequest("GET"), routeParams({}))).status).toBe(200);
  });

  it("還沒建城 → 總覽 409，設定讀得到", async () => {
    await seed();
    expect((await OVERVIEW(jsonRequest("GET"), routeParams({}))).status).toBe(409);
    const { body } = await json(await SETTING(jsonRequest("GET"), routeParams({})));
    expect(body.setting).toBeNull();
    expect(body.canEdit).toBe(true);
    expect(body.members).toHaveLength(3);
  });
});

describe("建城", () => {
  it("擁有者先選 Sean，Sean 自己答完；Sean 不能把負責人換成別人", async () => {
    const s = await seed();
    expect((await SET_OWNER(jsonRequest("PUT", { revenueOwnerUserId: s.sean.id }), routeParams({}))).status).toBe(200);

    as(s.nini.id);
    const nini = await SETUP(
      jsonRequest("POST", { revenueOwnerUserId: s.sean.id, startDate: START, openingBalance: 0, openingOwnerLoan: null }),
      routeParams({})
    );
    expect(nini.status).toBe(403);

    as(s.sean.id);
    const swap = await SETUP(
      jsonRequest("POST", { revenueOwnerUserId: s.nini.id, startDate: START, openingBalance: 0, openingOwnerLoan: null }),
      routeParams({})
    );
    expect(swap.status).toBe(403);
    await setupDone(s);
    const o = await overview();
    expect(o.setting.revenueOwner.name).toBe("Sean");
    expect(o.totals.vault).toBe(38000);
    expect(o.totals.ownerLoan).toBe(120000);
  });

  it("營收負責人不能填期初代收；略過建城貸款 → ownerLoan 是 null", async () => {
    const s = await seed();
    const bad = await SETUP(
      jsonRequest("POST", {
        revenueOwnerUserId: s.sean.id,
        startDate: START,
        openingBalance: 0,
        openingOwnerLoan: null,
        openingCustody: [{ userId: s.sean.id, amount: 100 }],
      }),
      routeParams({})
    );
    expect(bad.status).toBe(400);
    await setupDone(s, { openingOwnerLoan: null });
    expect((await overview()).totals.ownerLoan).toBeNull();
  });

  it("確認過繳回之後不能重新開帳", async () => {
    const s = await seed();
    await setupDone(s);
    const { body } = await json(await remit(1000));
    as(s.sean.id);
    await CONFIRM(jsonRequest("POST"), byId(body.id));
    as(s.dd.id);
    const again = await SETUP(
      jsonRequest("POST", { revenueOwnerUserId: s.sean.id, startDate: START, openingBalance: 0, openingOwnerLoan: null }),
      routeParams({})
    );
    expect(again.status).toBe(409);
  });
});

describe("代收與公司的錢", () => {
  it("啟用日之前的卡、沒收款人的卡、Sean 自己收的卡各歸各位", async () => {
    const s = await seed();
    await setupDone(s);
    await paidCard(s, s.dd.id, 2000, day("2026-09-30")); // 啟用日之前：不算
    await paidCard(s, s.dd.id, 2000); // 丁丁手上
    await paidCard(s, s.nini.id, 1800); // Nini 手上
    await paidCard(s, s.sean.id, 350); // 直接進大水庫
    await paidCard(s, null, 600); // 不知道誰收的

    const o = await overview();
    const hand = (id: number) => o.holders.find((h: { user: { id: number } }) => h.user.id === id);
    expect(hand(s.dd.id).inHand).toBe(3200 + 2000);
    expect(hand(s.nini.id).inHand).toBe(1800);
    expect(hand(s.sean.id)).toBeUndefined();
    expect(o.totals.vault).toBe(38000 + 350);
    expect(o.totals.company).toBe(38350 + 5200 + 1800);
    expect(o.unknownCards).toHaveLength(1);
    expect(o.unknownCards[0].amount).toBe(600);
    // 預收：所有付了錢、還沒上的卡（含啟用日之前的），每張 4/4 堂
    expect(o.totals.prepaid).toBe(2000 + 2000 + 1800 + 350 + 600);
    expect(o.totals.netWorth).toBe(o.totals.company - o.totals.prepaid - 120000);
  });

  it("超過設定天數沒繳 → overdue（先收先繳）", async () => {
    const s = await seed();
    await setupDone(s);
    await prisma.financeSetting.update({ where: { classroomId: s.classroom.id }, data: { overdueDays: 3 } });
    await prisma.financeSetting.update({
      where: { classroomId: s.classroom.id },
      data: { startDate: new Date(Date.now() - 10 * 86400_000) },
    });
    let dd = (await overview()).holders.find((h: { user: { id: number } }) => h.user.id === s.dd.id);
    expect(dd.overdue).toBe(true);
    expect(dd.daysHeld).toBeGreaterThanOrEqual(9);
    await remit(3200);
    dd = (await overview()).holders.find((h: { user: { id: number } }) => h.user.id === s.dd.id);
    expect(dd.inHand).toBe(0);
    expect(dd.overdue).toBe(false);
  });
});

describe("繳回", () => {
  it("送出 → 轉交中、推播給 Sean；Sean 確認 → 進大水庫、推播給丁丁", async () => {
    const s = await seed();
    await setupDone(s);
    const { status, body } = await json(await remit(3000));
    expect(status).toBe(200);
    expect(pushes.at(-1)).toMatchObject({ userIds: [s.sean.id] });
    let o = await overview();
    expect(o.totals.inTransit).toBe(3000);
    expect(o.pending).toHaveLength(1);
    expect(o.totals.company).toBe(38000 + 3200);

    as(s.dd.id);
    expect((await CONFIRM(jsonRequest("POST"), byId(body.id))).status).toBe(403);
    as(s.sean.id);
    expect((await CONFIRM(jsonRequest("POST"), byId(body.id))).status).toBe(200);
    expect(pushes.at(-1)).toMatchObject({ userIds: [s.dd.id], title: "錢收到了" });
    expect((await CONFIRM(jsonRequest("POST"), byId(body.id))).status).toBe(409);
    o = await overview();
    expect(o.totals.vault).toBe(41000);
    expect(o.totals.inTransit).toBe(0);
  });

  it("不能送超過手上的錢；營收負責人不用送", async () => {
    const s = await seed();
    await setupDone(s);
    expect((await remit(3201)).status).toBe(400);
    as(s.sean.id);
    expect((await remit(1)).status).toBe(400);
  });

  it("退回 → 錢回到手上；改了重送 → 又是轉交中", async () => {
    const s = await seed();
    await setupDone(s);
    const { body } = await json(await remit(3200));
    as(s.sean.id);
    expect((await REJECT(jsonRequest("POST", { reason: "" }), byId(body.id))).status).toBe(400);
    expect((await REJECT(jsonRequest("POST", { reason: "少 200" }), byId(body.id))).status).toBe(200);
    as(s.dd.id);
    let dd = (await overview()).holders.find((h: { user: { id: number } }) => h.user.id === s.dd.id);
    expect(dd.inHand).toBe(3200);

    as(s.nini.id);
    expect((await EDIT_REMIT(jsonRequest("PATCH", { amount: 3000, method: "CASH", sentOn: "2026-11-01" }), byId(body.id))).status).toBe(403);
    as(s.dd.id);
    const edited = await EDIT_REMIT(
      jsonRequest("PATCH", { amount: 3000, method: "TRANSFER", reference: "12345", sentOn: "2026-11-02" }),
      byId(body.id)
    );
    expect(edited.status).toBe(200);
    expect((await edited.json()).status).toBe("PENDING");
    dd = (await overview()).holders.find((h: { user: { id: number } }) => h.user.id === s.dd.id);
    expect(dd.inHand).toBe(200);
    expect(dd.pending).toBe(3000);
  });

  it("撤回之後錢回到手上，不能再確認", async () => {
    const s = await seed();
    await setupDone(s);
    const { body } = await json(await remit(1000));
    expect((await WITHDRAW(jsonRequest("POST"), byId(body.id))).status).toBe(200);
    as(s.sean.id);
    expect((await CONFIRM(jsonRequest("POST"), byId(body.id))).status).toBe(409);
    const dd = (await overview()).holders.find((h: { user: { id: number } }) => h.user.id === s.dd.id);
    expect(dd.inHand).toBe(3200);
  });

  it("存摺：每筆後面是手上餘額，最新的在上面", async () => {
    const s = await seed();
    await setupDone(s);
    await paidCard(s, s.dd.id, 2000);
    await remit(1000);
    const { body } = await json(await HOLDER(jsonRequest("GET"), routeParams({ userId: String(s.dd.id) })));
    expect(body.entries.map((e: { kind: string; balance: number }) => [e.kind, e.balance])).toEqual([
      ["remittance", 4200],
      ["card", 5200],
      ["opening", 3200],
    ]);
    expect(body.entries[1].studentName).toBe("麗心");
  });
});

describe("大水庫手記帳", () => {
  const entry = (extra: Record<string, unknown> = {}) =>
    ADD_ENTRY(jsonRequest("POST", { date: "2026-11-01", category: "VENUE", amount: 500, ...extra }), routeParams({}));

  it("只有 Sean 能記；支出減、老闆放錢加（也加欠老闆的）", async () => {
    const s = await seed();
    await setupDone(s);
    expect((await entry()).status).toBe(403);
    as(s.sean.id);
    expect((await entry({ payeeUserId: s.dd.id })).status).toBe(200);
    expect((await entry({ category: "OWNER_LOAN", amount: 10000 })).status).toBe(200);
    expect((await entry({ payeeUserId: s.dd.id, payeeName: "24steps" })).status).toBe(400);
    const o = await overview();
    expect(o.totals.vault).toBe(38000 - 500 + 10000);
    expect(o.totals.ownerLoan).toBe(130000);
  });

  it("改要寫原因、作廢不算進餘額，修改紀錄看得到", async () => {
    const s = await seed();
    await setupDone(s);
    as(s.sean.id);
    const { body } = await json(await entry());
    const patch = (reason: string) =>
      EDIT_ENTRY(jsonRequest("PATCH", { entry: { date: "2026-11-01", category: "VENUE", amount: 450 }, reason }), byId(body.id));
    expect((await patch("")).status).toBe(400);
    expect((await patch("打錯")).status).toBe(200);
    expect((await VOID_ENTRY(jsonRequest("POST", { reason: "重複" }), byId(body.id))).status).toBe(200);
    expect((await patch("再改")).status).toBe(409);

    const vault = await (await VAULT(jsonRequest("GET"), routeParams({}))).json();
    expect(vault.vault).toBe(38000);
    const row = vault.entries.find((e: { kind: string }) => e.kind === "entry");
    expect(row.voidedAt).not.toBeNull();
    expect(row.revisionCount).toBe(2);
    const history = await (await ENTRY_HISTORY(jsonRequest("GET"), byId(body.id))).json();
    expect(history.map((h: { reason: string }) => h.reason)).toEqual(["重複", "打錯"]);
  });

  it("大水庫存摺：期初、Sean 收的卡、確認的繳回、手記帳", async () => {
    const s = await seed();
    await setupDone(s);
    await paidCard(s, s.sean.id, 350);
    const { body } = await json(await remit(1000));
    as(s.sean.id);
    await CONFIRM(jsonRequest("POST"), byId(body.id));
    await entry({ date: "2026-11-05" });
    const vault = await (await VAULT(jsonRequest("GET"), routeParams({}))).json();
    expect(vault.entries.map((e: { kind: string; balance: number }) => [e.kind, e.balance])).toEqual([
      ["entry", 38850],
      ["remittance", 39350],
      ["card", 38350],
      ["opening", 38000],
    ]);
  });
});

describe("設定修改", () => {
  it("改期初數字要寫原因、留紀錄；Sean 不能換負責人", async () => {
    const s = await seed();
    await setupDone(s);
    expect((await PATCH_SETTING(jsonRequest("PATCH", { openingBalance: 40000 }), routeParams({}))).status).toBe(400);
    expect((await PATCH_SETTING(jsonRequest("PATCH", { openingBalance: 40000, reason: "漏算現金" }), routeParams({}))).status).toBe(200);
    expect((await PATCH_SETTING(jsonRequest("PATCH", { overdueDays: 5 }), routeParams({}))).status).toBe(200);
    as(s.sean.id);
    expect((await PATCH_SETTING(jsonRequest("PATCH", { revenueOwnerUserId: s.nini.id, reason: "x" }), routeParams({}))).status).toBe(403);
    const history = await (await SETTING_HISTORY(jsonRequest("GET"), routeParams({}))).json();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ reason: "漏算現金", before: { openingBalance: 38000 }, after: { openingBalance: 40000 } });
  });
});

describe("新手任務", () => {
  it("依角色合併；做到了才打勾", async () => {
    const s = await seed();
    await setupDone(s);
    let q = await (await QUESTS(jsonRequest("GET"), routeParams({}))).json();
    expect(q.roles).toEqual(["owner", "holder"]);
    expect(q.quests.find((x: { key: string }) => x.key === "chooseOwner").done).toBe(true);
    expect(q.quests.find((x: { key: string }) => x.key === "firstRemit").done).toBe(false);
    await remit(100);
    await MARK_QUEST(jsonRequest("POST", { quest: "notifiedMembers" }), routeParams({}));
    q = await (await QUESTS(jsonRequest("GET"), routeParams({}))).json();
    expect(q.quests.find((x: { key: string }) => x.key === "firstRemit").done).toBe(true);
    expect(q.quests.find((x: { key: string }) => x.key === "notifiedMembers").done).toBe(true);

    as(s.sean.id);
    q = await (await QUESTS(jsonRequest("GET"), routeParams({}))).json();
    expect(q.roles).toEqual(["revenueOwner"]);
    expect(q.quests.map((x: { key: string }) => x.key)).toEqual(["setup", "push", "trial", "firstEntry", "firstConfirm"]);
    expect((await MARK_QUEST(jsonRequest("POST", { quest: "nope" }), routeParams({}))).status).toBe(400);
  });
});
