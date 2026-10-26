/**
 * 月結淨額結算（純函式）。搬自 water-tank `src/lib/settlement.ts`；
 * 原本回傳拼好的 `note` 字串，這裡改成結構化欄位（`owed`／`offset`），字由畫面組。
 */

export type Payee = { name: string; owed: number };

/** 關帳時某人手上握著的教室的錢（收的課費、小水庫現金）。`reserve` 是要留在手上的零用金，不拿來抵。 */
export type CashHolding = { name: string; source: string; amount: number; reserve?: number };

/** 大水庫：誰負責轉出、錢從哪個帳戶出。 */
export type Tank = { owner: string; account: string };

export type SettlementLine = {
  name: string;
  /** 這個月的分潤 */
  owed: number;
  /** 手上可以拿來抵分潤的錢（已扣零用金） */
  offset: number;
  /** 正數＝大水庫要轉給他；負數＝他要繳回大水庫 */
  net: number;
};

export type PlannedTransfer = {
  id: string;
  /** payout＝大水庫轉給老師；remit＝老師繳回大水庫 */
  kind: "payout" | "remit";
  from: string;
  to: string;
  amount: number;
  /** 實際去轉帳的人 */
  executor: string;
  /** 收到後按確認的人 */
  confirmer: string;
  /** 怎麼算出來的：分潤 `owed` − 手上可抵 `offset` */
  owed: number;
  offset: number;
};

export type SettlementPlan = { lines: SettlementLine[]; transfers: PlannedTransfer[] };

/**
 * 每個人手上的錢先抵自己的分潤，只轉差額。
 * 不足的由大水庫轉出、多的繳回大水庫；老師之間不互轉，方便對帳。
 *
 * - 同一個人有好幾筆（例如兩個據點各收了錢），全部加起來抵；零用金按每一筆各自扣。
 * - 手上的錢比零用金少，那一筆不抵（不會變成負的）。
 * - 剛好抵完的人不用轉，只出現在 `lines`（`net === 0`）。
 * - 名單順序照第一次出現的順序：先分潤名單，再只有持有現金的人。
 */
export function planSettlement({
  payees,
  holdings,
  tank,
}: {
  payees: Payee[];
  holdings: CashHolding[];
  tank: Tank;
}): SettlementPlan {
  const names = [...new Set([...payees.map((p) => p.name), ...holdings.map((h) => h.name)])];

  const lines: SettlementLine[] = names.map((name) => {
    const owed = payees.filter((p) => p.name === name).reduce((sum, p) => sum + p.owed, 0);
    const offset = holdings
      .filter((h) => h.name === name)
      .reduce((sum, h) => sum + Math.max(0, h.amount - (h.reserve ?? 0)), 0);
    return { name, owed, offset, net: owed - offset };
  });

  const transfers: PlannedTransfer[] = lines
    .filter((line) => line.net !== 0)
    .map((line): PlannedTransfer => {
      const breakdown = { owed: line.owed, offset: line.offset };
      return line.net > 0
        ? {
            id: `payout-${line.name}`,
            kind: "payout",
            from: tank.account,
            to: line.name,
            amount: line.net,
            executor: tank.owner,
            confirmer: line.name,
            ...breakdown,
          }
        : {
            id: `remit-${line.name}`,
            kind: "remit",
            from: line.name,
            to: tank.account,
            amount: -line.net,
            executor: line.name,
            confirmer: tank.owner,
            ...breakdown,
          };
    });

  return { lines, transfers };
}
