import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, createLocation, jsonRequest, routeParams } from "../factories";
import { SYSTEM_ACCOUNTS, DEFAULT_EXPENSE_SUBACCOUNTS } from "@/domains/ledger/accounts";
import { ensureLedgerSetup } from "@/service/ledger/setup";
import { enableFinance } from "@/service/finance/setup";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { PATCH as LOCATION_PATCH } from "@/app/api/finance/locations/[id]/route";

describe("ledger setup (finance v2 P1)", () => {
  let classroomId: number;
  let ownerId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    ownerId = classroom.ownerId;
    auth.userId = ownerId;
    auth.classroomId = classroomId;
  });

  it("enabling finance creates the chart of accounts once", async () => {
    await enableFinance({ classroomId, userId: ownerId, legacyCustodianUserId: ownerId });
    const accounts = await prisma.ledgerAccount.findMany({ where: { classroomId } });
    const system = accounts.filter((a) => a.systemKey);
    expect(system.map((a) => a.systemKey).sort()).toEqual(SYSTEM_ACCOUNTS.map((a) => a.key).sort());
    const general = system.find((a) => a.systemKey === "EXPENSE_GENERAL")!;
    expect(accounts.filter((a) => a.parentId === general.id).map((a) => a.name)).toEqual([...DEFAULT_EXPENSE_SUBACCOUNTS]);

    await ensureLedgerSetup(classroomId);
    await ensureLedgerSetup(classroomId);
    expect(await prisma.ledgerAccount.count({ where: { classroomId } })).toBe(accounts.length);
  });

  it("custodians get a default cash money account once they keep a branch", async () => {
    await enableFinance({ classroomId, userId: ownerId, legacyCustodianUserId: ownerId });
    expect(await prisma.moneyAccount.count({ where: { classroomId } })).toBe(0); // 還沒有分部

    const sean = await createMember(classroomId, { email: "sean@test.local", name: "Sean" });
    await prisma.membership.update({
      where: { userId_classroomId: { userId: sean.id, classroomId } },
      data: { isCustodian: true },
    });
    const tainan = await createLocation(classroomId, { name: "台南", sortOrder: 0 });
    const kaohsiung = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });

    for (const [loc, keeper] of [[tainan, ownerId], [kaohsiung, sean.id]] as const) {
      const res = await LOCATION_PATCH(
        jsonRequest("PATCH", { keeperUserId: keeper }),
        routeParams({ id: String(loc.id) })
      );
      expect(res.status).toBe(200);
    }

    const money = await prisma.moneyAccount.findMany({
      where: { classroomId },
      include: { account: true },
      orderBy: { id: "asc" },
    });
    expect(money.map((m) => [m.holderUserId, m.locationId, m.isDefault, m.kind])).toEqual([
      [ownerId, tainan.id, true, "CASH"],
      [sean.id, kaohsiung.id, true, "CASH"],
    ]);
    const cash = await prisma.ledgerAccount.findFirstOrThrow({ where: { classroomId, systemKey: "CASH" } });
    expect(money.every((m) => m.account.parentId === cash.id && m.account.type === "ASSET")).toBe(true);
    expect(money.map((m) => m.account.code)).toEqual(["1111.01", "1111.02"]);

    // 再設一次負責人不會多建
    await ensureLedgerSetup(classroomId);
    expect(await prisma.moneyAccount.count({ where: { classroomId } })).toBe(2);
  });
});
