interface RevenueRecord {
  studentCard: { finalPrice: number; totalSessions: number } | null;
  /** 這筆出席扣了幾格（外師課 = 2）；省略 = 1。 */
  sessionsUsed?: number;
  /** 改付單堂時的金額（付了沒都算，同課卡營收不看 isPaid）。 */
  dropInCharge?: { amount: number } | null;
}

/**
 * 每堂課營收 = Σ 已扣卡學生的「該卡單格價」(finalPrice / totalSessions) × 扣的格數
 *            ＋ Σ 單堂費。
 * 沒扣卡也沒付單堂的不計入。
 */
export function periodRevenue(records: RevenueRecord[]): number {
  return records.reduce((sum, record) => {
    if (record.dropInCharge) return sum + record.dropInCharge.amount;
    if (!record.studentCard) return sum;
    return (
      sum +
      (record.studentCard.finalPrice / record.studentCard.totalSessions) * (record.sessionsUsed ?? 1)
    );
  }, 0);
}
