// 帳本設定：科目表與預設資金帳戶（docs/finance-v2/03-architecture.md §2、06 P1）。
// 冪等：任何時候呼叫都安全，只補缺的。
import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DEFAULT_EXPENSE_SUBACCOUNTS, SYSTEM_ACCOUNTS } from "@/domains/ledger/accounts";

type Db = PrismaClient | Prisma.TransactionClient;

/** 補齊系統科目與營業費用預設子科目。回傳 systemKey → accountId。 */
export async function ensureChartOfAccounts(db: Db, classroomId: number): Promise<Record<string, number>> {
  const existing = await db.ledgerAccount.findMany({
    where: { classroomId },
    select: { id: true, code: true, systemKey: true },
  });
  const byKey = new Map(existing.filter((a) => a.systemKey).map((a) => [a.systemKey!, a.id]));
  const codes = new Set(existing.map((a) => a.code));

  for (const a of SYSTEM_ACCOUNTS) {
    if (byKey.has(a.key)) continue;
    const created = await db.ledgerAccount.create({
      data: { classroomId, code: a.code, name: a.name, type: a.type, systemKey: a.key },
      select: { id: true },
    });
    byKey.set(a.key, created.id);
    codes.add(a.code);
  }

  const general = byKey.get("EXPENSE_GENERAL")!;
  const generalCode = SYSTEM_ACCOUNTS.find((a) => a.key === "EXPENSE_GENERAL")!.code;
  const hasChildren = await db.ledgerAccount.count({ where: { classroomId, parentId: general } });
  if (hasChildren === 0) {
    let n = 1;
    for (const name of DEFAULT_EXPENSE_SUBACCOUNTS) {
      let code = `${generalCode}.${String(n).padStart(2, "0")}`;
      while (codes.has(code)) code = `${generalCode}.${String(++n).padStart(2, "0")}`;
      await db.ledgerAccount.create({
        data: { classroomId, code, name, type: "EXPENSE", parentId: general },
      });
      codes.add(code);
      n++;
    }
  }
  return Object.fromEntries(byKey);
}

/**
 * 每位保管人一個預設資金帳戶（現金），分部＝他負責的第一個分部。
 * 還沒負責任何分部的保管人先不建（之後設分部負責人時再呼叫一次）。
 */
export async function ensureDefaultMoneyAccounts(db: Db, classroomId: number): Promise<void> {
  await ensureChartOfAccounts(db, classroomId);
  const [custodians, locations, existing] = await Promise.all([
    db.membership.findMany({ where: { classroomId, isCustodian: true }, select: { userId: true }, orderBy: { userId: "asc" } }),
    db.location.findMany({
      where: { classroomId, archivedAt: null, keeperUserId: { not: null } },
      select: { id: true, keeperUserId: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    db.moneyAccount.findMany({ where: { classroomId }, select: { holderUserId: true } }),
  ]);
  const hasAccount = new Set(existing.map((m) => m.holderUserId));
  for (const c of custodians) {
    if (hasAccount.has(c.userId)) continue;
    const loc = locations.find((l) => l.keeperUserId === c.userId);
    if (!loc) continue;
    await createMoneyAccount(db, classroomId, { holderUserId: c.userId, locationId: loc.id });
  }
}

/** 財務啟用的教室：科目表＋預設資金帳戶。 */
export async function ensureLedgerSetup(classroomId: number, db: Db = prisma): Promise<void> {
  await ensureDefaultMoneyAccounts(db, classroomId);
}

/** 新增一個資金帳戶（含現金子科目）。這位保管人的第一個帳戶自動成為預設。 */
export async function createMoneyAccount(
  db: Db,
  classroomId: number,
  args: { holderUserId: number; locationId: number; name?: string; kind?: "CASH" | "BANK" | "EWALLET" },
) {
  const accounts = await ensureChartOfAccounts(db, classroomId);
  const cashCode = SYSTEM_ACCOUNTS.find((a) => a.key === "CASH")!.code;
  const siblings = await db.ledgerAccount.findMany({ where: { classroomId, parentId: accounts.CASH }, select: { code: true } });
  const used = new Set(siblings.map((s) => s.code));
  let seq = siblings.length + 1;
  while (used.has(`${cashCode}.${String(seq).padStart(2, "0")}`)) seq++;
  const holder = await db.user.findUniqueOrThrow({ where: { id: args.holderUserId }, select: { name: true } });
  const name = args.name ?? `${holder.name} 手上的現金`;
  const hasDefault = (await db.moneyAccount.count({ where: { classroomId, holderUserId: args.holderUserId, isDefault: true } })) > 0;
  const account = await db.ledgerAccount.create({
    data: { classroomId, code: `${cashCode}.${String(seq).padStart(2, "0")}`, name, type: "ASSET", parentId: accounts.CASH },
    select: { id: true },
  });
  return db.moneyAccount.create({
    data: {
      classroomId,
      name,
      kind: args.kind ?? "CASH",
      holderUserId: args.holderUserId,
      locationId: args.locationId,
      accountId: account.id,
      isDefault: !hasDefault,
    },
  });
}
